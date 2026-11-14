import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { canPrepare, describeDeviceStatus } from '../ai/deviceStatus'
import { alertDocId, approvedAlert, areaKey, type SavedAlert } from '../alerts/record'
import { newLedgerId, saveApprovedAlert, withdrawAlert } from '../alerts/store'
import { withdrawalWrites } from '../ledger/record'
import { SAMPLE_BULLETIN } from '../factsheet/sample'
import { fromForm, toForm, type FactSheetForm } from '../factsheet/form'
import { parseBulletin } from '../factsheet/parse'
import { HOUSEHOLDS, type Household, type HouseholdId } from '../drafting/households'
import type { OfficerSession } from '../officer/OfficerGate'
import SystemStatus, { StatusSection } from '../officer/SystemStatus'
import type { SetupChecks } from '../officer/useSetupChecks'
import AccountMenu from './AccountMenu'
import { unrecordedDrafts, writtenBy } from './approval'
import DraftCard from './DraftCard'
import Drawer from './Drawer'
import FactSheetEditor from './FactSheetEditor'
import Ledger from './Ledger'
import SavedAlerts from './SavedAlerts'
import { attemptLog } from './log'
import { useDrafts } from './useDrafts'
import { useHybrid } from './useHybrid'
import { useLedger } from './useLedger'
import { useSavedAlerts } from './useSavedAlerts'
import { usePublishedTranslations, useTranslations } from './useTranslations'
import { cloudSummary, deviceSummary, modelPill, setupSummary, stepStates, viewFromHash, type Tone, type View } from './workspace'
import AppBar from '../ui/AppBar'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Dialog from '../ui/Dialog'
import Icon from '../ui/Icon'
import { TITLE, WIDTH } from '../ui/layout'
import Notice from '../ui/Notice'
import Progress from '../ui/Progress'

const STEP_IDS = ['step-bulletin', 'step-facts', 'step-drafts'] as const

/**
 * The officer workspace: an app bar with the model in use and the account, a
 * drawer, and three views. Creating an alert takes a bulletin in, a confirmed
 * fact sheet, and drafts checked, approved and saved; the saved alerts are
 * where one is translated or withdrawn; the ledger records every change.
 * Every view stays mounted while hidden, so a draft keeps streaming and an
 * edit keeps its text when the officer looks at another view.
 */
export default function OfficerConsole({ session, checks }: { session: OfficerSession; checks: SetupChecks }) {
  const hybrid = useHybrid()
  const [view, go] = useHashView()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const savedAlerts = useSavedAlerts(session.db)
  const ledger = useLedger(session.db)
  const [openEntry, setOpenEntry] = useState<string>()
  const savedList = useMemo(() => (savedAlerts.saved ? [...savedAlerts.saved.byId.values()] : undefined), [savedAlerts.saved])
  const [withdrawErrors, setWithdrawErrors] = useState<Partial<Record<string, string>>>({})
  const [saveErrors, setSaveErrors] = useState<Partial<Record<HouseholdId, string>>>({})
  const [bulletin, setBulletin] = useState('')
  const [form, setForm] = useState<FactSheetForm>()
  const [notFound, setNotFound] = useState<string[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const [area, setArea] = useState('')

  const parsed = useMemo(() => (form ? fromForm(form, bulletin) : undefined), [form, bulletin])
  const sheet = parsed?.ok && confirmed ? parsed.sheet : undefined
  const areas = parsed?.ok ? parsed.sheet.signals.map((s) => s.area) : []
  const claimWords = hybrid.tunables?.checkerClaimWords ?? []
  const published = usePublishedTranslations(session.db)
  const translations = useTranslations({
    db: session.db,
    uid: session.uid,
    model: hybrid.translationModel,
    cloudModel: hybrid.tunables?.cloudModelName ?? '',
    claimWords,
    translationClaims: hybrid.tunables?.translationClaims,
  })

  const drafts = useDrafts({
    sheet,
    area,
    claimWords,
    models: hybrid.models,
    deviceRef: hybrid.deviceRef,
    warmPromise: hybrid.warmPromise,
  })
  const busy = HOUSEHOLDS.some((h) => drafts.drafts[h.id].running)
  const areaSaveKey = areaKey(area)

  /**
   * Approving saves: approvedAlert() runs the checker again on the exact text,
   * then the alert replaces the last one saved for this household and area,
   * together with its ledger entry, which keeps the drafts behind it.
   * Offline it waits on the laptop; the card shows that from the saved alerts.
   */
  function approve(h: Household) {
    if (!sheet) return
    const draft = drafts.drafts[h.id]
    const approval = approvedAlert({
      text: draft.text,
      sheet,
      area,
      household: h,
      claimWords,
      source: writtenBy(draft),
      edited: draft.edited ?? false,
    })
    const showError = (message: string | undefined) => setSaveErrors((all) => ({ ...all, [h.id]: message }))
    if (!approval.ok) {
      showError(approval.reason)
      return
    }
    showError(undefined)
    const trail = unrecordedDrafts(draft)
    drafts.setApproved(h.id, true)
    // These drafts are in this approval's entry, so the next approval of the card doesn't repeat them.
    drafts.setRecordedThrough(h.id, trail.through)
    const cloudModel = hybrid.tunables?.cloudModelName ?? ''
    saveApprovedAlert(session.db, session.uid, approval, { drafts: trail.drafts, cloudModel, claimWords }).catch((err: unknown) => {
      drafts.setApproved(h.id, false)
      drafts.setRecordedThrough(h.id, draft.recordedThrough)
      showError(`Not saved: ${err instanceof Error ? err.message : String(err)}`)
    })
  }

  /**
   * Withdrawing marks the saved alert withdrawn and writes its ledger entry
   * with the reason, in one batch. Offline it waits on the laptop; the saved
   * alerts list shows that. Returns why it can't start, if it can't.
   */
  function withdraw(alert: SavedAlert, reason: string): string | undefined {
    const writes = withdrawalWrites(alert, newLedgerId(session.db), reason)
    if (!writes.ok) return writes.reason
    setWithdrawErrors((all) => ({ ...all, [alert.id]: undefined }))
    withdrawAlert(session.db, session.uid, writes).catch((err: unknown) => {
      setWithdrawErrors((all) => ({ ...all, [alert.id]: `Not withdrawn: ${err instanceof Error ? err.message : String(err)}` }))
    })
    return undefined
  }

  // A second of resolution is enough for the budget and the timers.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!busy && hybrid.warmUp.state !== 'warming') return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [busy, hybrid.warmUp.state])

  function readBulletin(text: string) {
    const result = parseBulletin(text)
    setBulletin(text)
    setForm(toForm(result.sheet))
    setNotFound(result.notFound)
    setConfirmed(false)
    setArea(result.sheet.signals[0]?.area ?? '')
    drafts.reset()
    setSaveErrors({})
  }

  function editForm(next: FactSheetForm) {
    setForm(next)
    setConfirmed(false)
    drafts.unapproveAll()
  }

  const canDraft = Boolean(sheet && area && hybrid.models && !busy && (hybrid.online || hybrid.device === 'available'))

  const steps = stepStates({
    bulletinRead: form !== undefined,
    factsConfirmed: sheet !== undefined,
    allApproved: sheet !== undefined && HOUSEHOLDS.every((h) => drafts.drafts[h.id].approved),
  })
  const warmingSeconds = hybrid.warmUp.state === 'warming' ? Math.max(0, (now - hybrid.warmUp.startedAt) / 1000) : undefined
  const pill = modelPill({ online: hybrid.online, device: hybrid.device, download: hybrid.download, warmingSeconds })
  const status = [
    { label: 'On-device model', summary: deviceSummary(hybrid.device) },
    { label: 'Cloud', summary: cloudSummary(hybrid.online) },
    {
      label: 'Firebase',
      summary: checks.configured ? setupSummary([checks.appCheck.state, checks.remoteConfig.state]) : setupSummary(['error']),
    },
  ]
  const activeAlerts = savedList?.filter((a) => !a.withdrawn).length
  const waitingToUpload = savedList?.some((a) => a.pending) ?? false
  const testLog = HOUSEHOLDS.some((h) => drafts.drafts[h.id].attempts.length > 0)
    ? attemptLog(HOUSEHOLDS, drafts.drafts, {
        area,
        cloudModel: hybrid.tunables?.cloudModelName ?? 'none',
        device: hybrid.device,
        warmUp:
          hybrid.warmUp.state === 'warm'
            ? `warmed up in ${hybrid.warmUp.seconds.toFixed(1)} s (${hybrid.warmUp.source ?? 'unknown source'})`
            : `warm-up ${hybrid.warmUp.state}`,
      })
    : undefined

  function openView(next: View) {
    setDrawerOpen(false)
    go(next)
    // After the view shows: start it at the top, as a new page would.
    requestAnimationFrame(() => window.scrollTo({ top: 0 }))
  }

  function openStep(index: number) {
    setDrawerOpen(false)
    go('create')
    // After the view shows and the drawer sheet has closed and handed focus back.
    requestAnimationFrame(() => {
      const step = document.getElementById(STEP_IDS[index])
      step?.scrollIntoView({ block: 'start' })
      step?.focus({ preventScroll: true })
    })
  }

  function showLedgerEntry(id: string) {
    setOpenEntry(id)
    go('ledger')
  }

  const drawer = (
    <Drawer
      view={view}
      steps={steps}
      activeAlerts={activeAlerts}
      waitingToUpload={waitingToUpload}
      status={status}
      onStep={openStep}
      onView={openView}
      onStatus={() => {
        setDrawerOpen(false)
        setStatusOpen(true)
      }}
    />
  )

  return (
    <>
      <AppBar
        title={TITLE.officer}
        width={WIDTH.officer}
        leading={
          <button
            type="button"
            aria-label="Open the workspace menu"
            onClick={() => setDrawerOpen(true)}
            className="-ml-1 flex size-12 items-center justify-center rounded-full hover:bg-on-brand/10 focus-visible:outline-on-brand lg:hidden"
          >
            <Icon name="menu" className="size-6" />
          </button>
        }
      >
        <ModelPill pill={pill} onClick={() => setStatusOpen(true)} />
        <AccountMenu user={session.user} onSignOut={() => void session.signOut()} error={session.accountError} />
      </AppBar>

      {!hybrid.online && (
        <div role="status" className="flex items-start gap-3 bg-warning-container px-4 py-3 text-body-md text-on-warning-container">
          <Icon name="wifi_off" className="mt-px size-5" />
          <p>
            {hybrid.device === 'available'
              ? 'You’re offline. Drafts use the on-device model, and saves wait on this laptop until you’re back online.'
              : 'You’re offline, and this laptop has no on-device model, so drafting waits for the connection. Saves wait on this laptop until you’re back online.'}
          </p>
        </div>
      )}

      <div className="flex flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-outline-variant bg-surface-container-low lg:block">
          <div className="sticky top-0 max-h-dvh overflow-y-auto">{drawer}</div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl">
            {session.user.method === 'password' && (
              <Notice tone="primary" className="mb-6">
                This is the shared test officer account for judges. Other judges see what you approve or withdraw, and the ledger
                records it under this account.
              </Notice>
            )}

            <div hidden={view !== 'create'}>
              <ViewHeading title="Create an alert">
                Read the storm bulletin, confirm its facts, then draft an alert for each household and approve the ones that pass
                the checks.
              </ViewHeading>
              <div className="space-y-6">
                <Card title="1. Bulletin" id={STEP_IDS[0]}>
                  <label className="block text-body-md font-medium" htmlFor="bulletin">
                    Paste the storm bulletin
                  </label>
                  <textarea
                    id="bulletin"
                    value={bulletin}
                    onChange={(e) => setBulletin(e.target.value)}
                    rows={6}
                    className="field mt-1 font-mono text-body-sm"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="filled" onClick={() => readBulletin(bulletin)} disabled={bulletin.trim() === '' || busy}>
                      Read bulletin
                    </Button>
                    <Button variant="text" onClick={() => readBulletin(SAMPLE_BULLETIN)} disabled={busy}>
                      Use the demo bulletin
                    </Button>
                  </div>
                </Card>

                {form && (
                  <Card title="2. Fact sheet" id={STEP_IDS[1]}>
                    {notFound.length > 0 && (
                      <Notice tone="warning" className="mb-4">
                        Not found in the bulletin: {notFound.join(', ')}. Fill these in if the bulletin has them.
                      </Notice>
                    )}
                    <FactSheetEditor form={form} onChange={editForm} disabled={busy} />
                    {parsed && !parsed.ok && (
                      <ul className="mt-3 list-disc pl-5 text-body-md text-error">
                        {parsed.problems.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    )}
                    <label className="mt-4 flex min-h-12 items-center gap-3 text-body-md font-medium">
                      <input
                        type="checkbox"
                        className="size-[18px] accent-primary"
                        checked={confirmed}
                        disabled={!parsed?.ok || busy}
                        onChange={(e) => {
                          setConfirmed(e.target.checked)
                          drafts.unapproveAll()
                        }}
                      />
                      I checked every fact against the bulletin
                    </label>
                  </Card>
                )}

                {sheet && (
                  <Card title="3. Draft, check and approve" id={STEP_IDS[2]}>
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="text-body-md font-medium">
                        Area
                        <select
                          className="field ml-2 w-auto"
                          value={area}
                          onChange={(e) => {
                            setArea(e.target.value)
                            drafts.unapproveAll()
                          }}
                          disabled={busy}
                        >
                          {areas.map((a) => (
                            <option key={a}>{a}</option>
                          ))}
                        </select>
                      </label>
                      <Button variant="tonal" onClick={() => void drafts.draftAll()} disabled={!canDraft}>
                        Draft all four
                      </Button>
                    </div>
                    <div className="mt-4 space-y-4">
                      {HOUSEHOLDS.map((h) => (
                        <DraftCard
                          key={h.id}
                          household={h}
                          draft={drafts.drafts[h.id]}
                          sheet={sheet}
                          area={area}
                          claimWords={claimWords}
                          now={now}
                          budgetSeconds={hybrid.tunables?.ondeviceBudgetSeconds ?? 30}
                          cloudModel={hybrid.tunables?.cloudModelName ?? ''}
                          online={hybrid.online}
                          canDraft={canDraft}
                          onDraft={() => void drafts.draft(h)}
                          onAbandon={() => drafts.abandon(h.id)}
                          onEdit={(text) => drafts.edit(h.id, text)}
                          saved={areaSaveKey ? savedAlerts.saved?.byId.get(alertDocId(h.id, areaSaveKey)) : undefined}
                          saveError={saveErrors[h.id]}
                          onApprove={() => approve(h)}
                          onShowLedger={showLedgerEntry}
                        />
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </div>

            <div hidden={view !== 'saved'}>
              <ViewHeading title="Saved alerts" />
              <SavedAlerts
                saved={savedList}
                unreadable={savedAlerts.saved?.unreadable ?? []}
                error={savedAlerts.error}
                uid={session.uid}
                withdrawErrors={withdrawErrors}
                onWithdraw={withdraw}
                onShowLedger={showLedgerEntry}
                translations={{
                  published: published.published,
                  error: published.error,
                  actions: translations,
                  canTranslate: Boolean(hybrid.translationModel && hybrid.online),
                  claimWords,
                  translationClaims: hybrid.tunables?.translationClaims,
                }}
              />
            </div>

            <div hidden={view !== 'ledger'}>
              <ViewHeading title="Ledger" />
              <Ledger
                view={ledger.view}
                error={ledger.error}
                saved={savedAlerts.saved?.byId}
                published={published.published}
                uid={session.uid}
                openId={openEntry}
                onOpen={setOpenEntry}
              />
            </div>
          </div>
        </main>
      </div>

      <Dialog open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Workspace" side="left">
        {drawer}
      </Dialog>

      <SystemStatus open={statusOpen} onClose={() => setStatusOpen(false)} checks={checks}>
        <StatusSection title="On-device model">
          <p>{describeDeviceStatus(hybrid.device)}</p>
          {hybrid.warmUp.state === 'warming' && (
            <p className="mt-1 text-on-surface-variant">Warming up · {Math.round(warmingSeconds ?? 0)} s</p>
          )}
          {hybrid.warmUp.state === 'warm' && (
            <p className="mt-1 text-on-surface-variant">
              {hybrid.warmUp.source === 'in_cloud' ? 'Warm-up answered from the cloud' : 'Warmed up'} in{' '}
              {hybrid.warmUp.seconds.toFixed(1)} s
            </p>
          )}
          {hybrid.warmUp.state === 'failed' && <p className="mt-1 text-error">Warm-up failed: {hybrid.warmUp.error}</p>}
          {canPrepare(hybrid.device) && hybrid.models && (
            <div className="mt-3">
              <Button size="sm" variant="tonal" onClick={() => void hybrid.prepare()} disabled={hybrid.download !== undefined}>
                {hybrid.download === undefined ? 'Prepare on-device model' : `Downloading ${Math.round(hybrid.download * 100)}%`}
              </Button>
              {hybrid.download !== undefined && (
                <Progress value={hybrid.download} label="On-device model download" className="mt-3" />
              )}
            </div>
          )}
        </StatusSection>
        <StatusSection title="Cloud">
          <p>
            {!hybrid.configured
              ? 'Not configured: you can still write and check alerts by hand'
              : hybrid.online
                ? `Online · ${hybrid.tunables?.cloudModelName ?? 'loading'}`
                : 'Offline: only the on-device model can draft'}
          </p>
        </StatusSection>
        <StatusSection title="Account">
          <p>
            {session.user.name || session.user.email || 'Officer'}
            <span className="text-on-surface-variant">
              {' · '}
              {session.user.method === 'password' ? 'shared test officer' : 'officer, signed in with Google'}
            </span>
          </p>
        </StatusSection>
        <StatusSection title="Developer">
          {testLog && !busy ? (
            <TestLog text={testLog} />
          ) : (
            <p className="text-on-surface-variant">
              {busy ? 'The test log is ready when the drafts finish.' : 'The test log of prompts, answers and problems appears here after a draft.'}
            </p>
          )}
        </StatusSection>
      </SystemStatus>
    </>
  )
}

/** The current view's name, and what it is for when the view doesn't say so itself. */
function ViewHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6">
      <h1 className="text-headline-md">{title}</h1>
      {children && <p className="mt-1 text-body-lg text-on-surface-variant">{children}</p>}
    </div>
  )
}

const PILL_DOT: Record<Tone, string> = {
  // Light tints, since the pill sits on the navy app bar.
  ok: 'bg-success-container',
  busy: 'bg-on-brand-variant',
  warn: 'bg-highlight-on-brand',
  off: 'bg-on-brand-variant/50',
  problem: 'bg-error-container',
}

/** Which model drafts now; opens System status. Only the dot and icon show on a phone. */
function ModelPill({ pill, onClick }: { pill: ReturnType<typeof modelPill>; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${pill.text}. Open System status`}
      className="relative flex h-10 items-center gap-2 rounded-full border border-on-brand-variant/40 px-3 text-label-lg hover:bg-on-brand/10 focus-visible:outline-on-brand before:absolute before:inset-x-0 before:top-1/2 before:h-12 before:-translate-y-1/2"
    >
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${PILL_DOT[pill.tone]}`} />
      <Icon name={pill.icon} className="size-[18px]" />
      <span className="hidden max-w-72 truncate md:inline">{pill.text}</span>
    </button>
  )
}

/** The view in the address, so the back button and a reload keep it: `#saved`, `#ledger`, or nothing for creating an alert. */
function useHashView(): [View, (view: View) => void] {
  const [view, setView] = useState(() => viewFromHash(window.location.hash))
  useEffect(() => {
    const sync = () => setView(viewFromHash(window.location.hash))
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [])
  function go(next: View) {
    if (next === viewFromHash(window.location.hash)) return
    const { pathname, search } = window.location
    window.history.pushState(null, '', next === 'create' ? pathname + search : `#${next}`)
    setView(next)
  }
  return [view, go]
}

/** Every attempt as plain text, to paste into the thread or a PR. */
function TestLog({ text }: { text: string }) {
  const [copiedText, setCopiedText] = useState('')
  const copied = copiedText === text
  return (
    <div>
      <Button
        size="sm"
        onClick={() =>
          navigator.clipboard.writeText(text).then(
            () => setCopiedText(text),
            () => setCopiedText(''),
          )
        }
      >
        {copied ? 'Copied: paste it into the chat' : 'Copy test log'}
      </Button>
      <details className="mt-3">
        <summary className="cursor-pointer text-on-surface-variant">Show the test log (prompts, answers and problems)</summary>
        <textarea readOnly value={text} rows={12} className="field mt-2 font-mono text-body-sm" />
      </details>
    </div>
  )
}
