import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { canPrepare, describeDeviceStatus } from '../ai/deviceStatus'
import { approvedAlert, LIMITS, type SavedAlert } from '../alerts/record'
import { newLedgerId, saveApprovedAlert, withdrawAlert } from '../alerts/store'
import { withdrawalWrites } from '../ledger/record'
import type { CloudReading, Unconfirmed } from '../factsheet/cloud'
import { LONG_BULLETIN, SAMPLE_BULLETIN } from '../factsheet/sample'
import { fromForm, toForm, type FactSheetForm } from '../factsheet/form'
import { parseBulletin } from '../factsheet/parse'
import { HOUSEHOLDS, type Household, type HouseholdId } from '../drafting/households'
import type { OfficerSession } from '../officer/OfficerGate'
import SystemStatus, { StatusSection } from '../officer/SystemStatus'
import type { SetupChecks } from '../officer/useSetupChecks'
import AccountMenu from './AccountMenu'
import { unrecordedDrafts, writtenBy } from './approval'
import AlertBuilder from './AlertBuilder'
import BulletinReading from './BulletinReading'
import {
  approvalsCleared,
  bulletinReadText,
  cloudReadBlock,
  draftBlockReason,
  draftsCleared,
  greeting,
  missingFacts,
  openFactFields,
  type ReadBy,
} from './create'
import Drawer from './Drawer'
import FactSheetEditor from './FactSheetEditor'
import StormSummary from './StormSummary'
import Ledger, { LEDGER_DETAIL_ID } from './Ledger'
import SavedAlerts, { SAVED_DETAIL_ID, type SavedPick } from './SavedAlerts'
import { attemptLog, readingLog } from './log'
import { useCloudReading } from './useCloudReading'
import { useDrafts } from './useDrafts'
import { useHybrid } from './useHybrid'
import { useLedger } from './useLedger'
import { ALL_SAVED } from './savedView'
import { useSavedAlerts } from './useSavedAlerts'
import { usePublishedTranslations, useTranslations } from './useTranslations'
import { cloudSummary, deviceSummary, lastOpenStep, modelPill, setupSummary, stepStates, entryFromHash, hashFor, viewFromHash, type Tone, type View } from './workspace'
import AppBar from '../ui/AppBar'
import Button from '../ui/Button'
import Dialog from '../ui/Dialog'
import Icon from '../ui/Icon'
import { TITLE } from '../ui/layout'
import Notice from '../ui/Notice'
import Progress from '../ui/Progress'
import Snackbar, { type SnackbarMessage } from '../ui/Snackbar'

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
  const [{ view, entry: openEntry }, go] = useHashRoute()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [step, setStep] = useState(0)
  // The greeting's time of day, from when the workspace opened.
  const [openedHour] = useState(() => new Date().getHours())
  const savedAlerts = useSavedAlerts(session.db)
  const ledger = useLedger(session.db)
  // Kept here, not in the view, so "Next: translate" can open an alert in it.
  const [savedPick, setSavedPick] = useState<SavedPick>({ filter: ALL_SAVED, selected: undefined })
  const savedList = useMemo(() => (savedAlerts.saved ? [...savedAlerts.saved.byId.values()] : undefined), [savedAlerts.saved])
  const [withdrawErrors, setWithdrawErrors] = useState<Partial<Record<string, string>>>({})
  const [saveErrors, setSaveErrors] = useState<Partial<Record<HouseholdId, string>>>({})
  /** The bulletin box, and the text last read from it: the facts come from the one read. */
  const [bulletinInput, setBulletinInput] = useState('')
  const [bulletin, setBulletin] = useState('')
  const [editingBulletin, setEditingBulletin] = useState(false)
  const [editingFacts, setEditingFacts] = useState(false)
  const [snack, setSnack] = useState<SnackbarMessage>()
  const snackCount = useRef(0)
  const closeSnack = useCallback(() => setSnack(undefined), [])
  const [form, setForm] = useState<FactSheetForm>()
  const [notFound, setNotFound] = useState<string[]>([])
  /** Facts the cloud gave that code couldn't find in the bulletin's words, so they were left out. */
  const [unconfirmed, setUnconfirmed] = useState<Unconfirmed[]>([])
  const [readBy, setReadBy] = useState<ReadBy>('code')
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
  const cloudReading = useCloudReading({ model: hybrid.readingModel, cloudModel: hybrid.tunables?.cloudModelName ?? '' })
  const reading = cloudReading.status.state === 'reading'
  const missing = missingFacts(notFound, unconfirmed)

  /** Shows a snackbar, when there is something to say. */
  function say(text: string | undefined) {
    if (text) setSnack({ id: ++snackCount.current, text })
  }

  /** Clears every approval on the panels and says so: they were for facts or an area that no longer hold. */
  function clearApprovals(cause: Parameters<typeof approvalsCleared>[0]) {
    const count = HOUSEHOLDS.filter((h) => drafts.drafts[h.id].approved).length
    drafts.unapproveAll()
    say(approvalsCleared(cause, count))
  }

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
    if (!busy && !reading && hybrid.warmUp.state !== 'warming') return
    const timer = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(timer)
  }, [busy, reading, hybrid.warmUp.state])

  /** How many readings have filled the fact sheet, so a cloud answer for an earlier one is dropped. */
  const readings = useRef(0)

  /** Puts a reading in the fact sheet, for the officer to check: it replaces the facts and clears the drafts. */
  function applyReading(text: string, result: Pick<CloudReading, 'sheet' | 'unconfirmed'> & { notFound: string[] }, by: ReadBy) {
    const drafted = HOUSEHOLDS.filter((h) => drafts.drafts[h.id].attempts.length > 0 || drafts.drafts[h.id].text.trim() !== '').length
    readings.current += 1
    setBulletinInput(text)
    setBulletin(text)
    setEditingBulletin(false)
    // The fact sheet opens as text boxes, so the officer checks and fixes each fact before reading it as a summary.
    setEditingFacts(true)
    setForm(toForm(result.sheet))
    setNotFound(result.notFound)
    setUnconfirmed(result.unconfirmed)
    setReadBy(by)
    setConfirmed(false)
    setArea(result.sheet.signals[0]?.area ?? '')
    drafts.reset()
    setSaveErrors({})
    say(draftsCleared(drafted))
  }

  /** Reads the bulletin with plain code on the laptop: the demo format, no AI. */
  function readBulletin(text: string) {
    cloudReading.reset()
    applyReading(text, { ...parseBulletin(text), unconfirmed: [] }, 'code')
  }

  /**
   * Reads the bulletin in the cloud: the text last read, not the box being
   * edited. One call per click. Code keeps only the facts it finds in the
   * bulletin's words; the officer confirms them.
   */
  async function readInCloud() {
    const text = bulletin
    const seq = readings.current
    const result = await cloudReading.read(text)
    // The officer can't read another bulletin meanwhile (the buttons are off), but a stale answer must never land.
    if (result && readings.current === seq) applyReading(text, result, 'cloud')
  }
  const cloudBlock = cloudReadBlock({
    online: hybrid.online,
    modelReady: hybrid.readingModel !== undefined,
    busy,
    length: bulletin.length,
    maxLength: LIMITS.bulletinText,
  })

  function editForm(next: FactSheetForm) {
    setForm(next)
    setConfirmed(false)
    clearApprovals('facts')
  }

  const blockReason = !area
    ? 'Choose an area first.'
    : reading
      ? // Its answer replaces the facts and clears the drafts, so a draft started now would be lost.
        'The cloud is reading the bulletin. Drafting waits for the new facts.'
      : draftBlockReason({ modelsReady: hybrid.models !== undefined, online: hybrid.online, device: hybrid.device, busy, batch: drafts.batch })

  const steps = stepStates({
    bulletinRead: form !== undefined,
    factsConfirmed: sheet !== undefined,
    allApproved: sheet !== undefined && HOUSEHOLDS.every((h) => drafts.drafts[h.id].approved),
  })
  // A step that locks while open (none can today) falls back to the last one open, so the view is never empty.
  const openIndex = steps[step].state === 'locked' ? lastOpenStep(steps) : step
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
  const testLog = HOUSEHOLDS.some((h) => drafts.drafts[h.id].attempts.length > 0) || cloudReading.log
    ? attemptLog(HOUSEHOLDS, drafts.drafts, {
        area,
        cloudModel: hybrid.tunables?.cloudModelName ?? 'none',
        device: hybrid.device,
        warmUp:
          hybrid.warmUp.state === 'warm'
            ? `warmed up in ${hybrid.warmUp.seconds.toFixed(1)} s (${hybrid.warmUp.source ?? 'unknown source'})`
            : `warm-up ${hybrid.warmUp.state}`,
      }) + (cloudReading.log ? `\n${readingLog(cloudReading.log)}` : '')
    : undefined

  function openView(next: View) {
    setDrawerOpen(false)
    go(next)
    // After the view shows: start it at the top, as a new page would.
    requestAnimationFrame(() => window.scrollTo({ top: 0 }))
  }

  /** Shows one step of creating an alert, from the drawer or a step's Back and Next buttons. */
  function openStep(index: number) {
    setDrawerOpen(false)
    setStep(index)
    go('create')
    // After the step shows and the drawer sheet has closed and handed focus back: start at its top, as a new page would.
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0 })
      document.getElementById(STEP_IDS[index])?.focus({ preventScroll: true })
    })
  }

  /** Opens a saved alert under *Saved alerts*, where it is translated. */
  function showSavedAlert(id: string) {
    // Every filter off, so the alert is in the list whatever was picked before.
    setSavedPick({ filter: ALL_SAVED, selected: id })
    go('saved')
    requestAnimationFrame(() => {
      const detail = document.getElementById(SAVED_DETAIL_ID)
      // Under 1024 px the detail sits below the list.
      if (detail && !window.matchMedia('(min-width: 64rem)').matches) detail.scrollIntoView({ block: 'start' })
      else window.scrollTo({ top: 0 })
      detail?.focus({ preventScroll: true })
    })
  }

  /** Opens a ledger entry from a link elsewhere, with focus on it, as a new page would. */
  function showLedgerEntry(id: string) {
    go('ledger', id)
    requestAnimationFrame(() => {
      // Under 1024 px the ledger brings the entry into view itself.
      if (window.matchMedia('(min-width: 64rem)').matches) window.scrollTo({ top: 0 })
      document.getElementById(LEDGER_DETAIL_ID)?.focus({ preventScroll: true })
    })
  }

  const drawer = (
    <Drawer
      view={view}
      steps={steps}
      openStep={openIndex}
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

        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:pt-4">
          {/* Saved alerts and the ledger are wider: a list and the open item side by side. */}
          <div className={`mx-auto ${view === 'create' ? 'max-w-4xl' : 'max-w-6xl'}`}>
            {session.user.method === 'password' && (
              <Notice tone="primary" className="mb-6 lg:mb-3 lg:py-2">
                This is the shared test officer account for judges. Other judges see what you approve or withdraw, and the ledger
                records it under this account.
              </Notice>
            )}

            <div hidden={view !== 'create'}>
              <div className="mb-4 lg:mb-3">
                <h1 className="text-headline-sm sm:text-headline-md">{greeting(openedHour, session.user)}</h1>
                <p className="mt-1 text-body-lg text-on-surface-variant">
                  Create an alert from a storm bulletin. Every fact is checked before you approve it.
                </p>
              </div>
              {sheet && <StormSummary sheet={sheet} />}
              <StepCard
                index={0}
                open={openIndex}
                title="Bulletin"
                next={{
                  label: 'Next: Fact sheet',
                  enabled: form !== undefined,
                  hint: 'Read a bulletin to continue.',
                  done: bulletinReadText(readBy, missing.length),
                }}
                onGo={openStep}
              >
                {form && !editingBulletin ? (
                  // Once read, the bulletin stays in view, so the officer can check the facts in the next step against it.
                  <div className="rounded-md bg-surface-container-low">
                    <div className="flex items-center gap-3 border-b border-outline-variant py-1 pr-2 pl-4">
                      <Icon name="description" className="size-5 text-on-surface-variant" />
                      <h3 className="flex-1 text-title-sm">The bulletin you read</h3>
                      <Button variant="text" onClick={() => setEditingBulletin(true)} disabled={busy || reading}>
                        <Icon name="edit" className="size-[18px]" />
                        Edit
                      </Button>
                    </div>
                    {/*
                      A long bulletin scrolls inside the box, so Next stays in view above the step's footer on a short laptop
                      screen; the demo bulletin fits whole. The focus stop lets a keyboard scroll it.
                    */}
                    <div
                      role="region"
                      aria-label="Bulletin text"
                      tabIndex={0}
                      className="max-h-[60vh] overflow-y-auto rounded-b-md px-4 py-3 text-body-md whitespace-pre-wrap lg:max-h-[max(10rem,calc(100vh_-_28rem))]"
                    >
                      {/* A line apiece, with a little space between, so a line that wraps on a phone still reads as one. */}
                      {bulletin
                        .trim()
                        .split('\n')
                        .map((line, i) => (
                          <span key={i} className="block min-h-5 not-first:mt-1">
                            {line}
                          </span>
                        ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <label className="block text-title-sm" htmlFor="bulletin">
                      Paste the storm bulletin
                    </label>
                    <textarea
                      id="bulletin"
                      value={bulletinInput}
                      onChange={(e) => setBulletinInput(e.target.value)}
                      rows={8}
                      // Seven lines, the demo bulletin's length, so the step fits above the sticky footer on a short laptop screen.
                      className="field mt-1 font-mono text-body-sm lg:h-32"
                    />
                    {form && (
                      <p className="mt-2 text-body-md text-on-surface-variant">
                        Reading it again replaces the fact sheet and clears the drafts. Saved alerts stay as they are.
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        variant="filled"
                        onClick={() => readBulletin(bulletinInput)}
                        disabled={bulletinInput.trim() === '' || busy || reading}
                      >
                        Read bulletin
                      </Button>
                      <Button variant="text" onClick={() => readBulletin(SAMPLE_BULLETIN)} disabled={busy || reading}>
                        Use the demo bulletin
                      </Button>
                      {/* Laid out like a real bulletin, so plain code misses facts and the cloud reading has work to do. */}
                      <Button variant="text" onClick={() => readBulletin(LONG_BULLETIN)} disabled={busy || reading}>
                        Use the long demo bulletin
                      </Button>
                      {form && (
                        <Button
                          variant="text"
                          onClick={() => {
                            setBulletinInput(bulletin)
                            setEditingBulletin(false)
                          }}
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </StepCard>

              {form && (
                <StepCard
                  index={1}
                  open={openIndex}
                  title="Fact sheet"
                  action={
                    <Button
                      variant="text"
                      onClick={() => setEditingFacts(!editingFacts)}
                      disabled={busy || reading || (editingFacts && !parsed?.ok)}
                    >
                      {editingFacts ? <Icon name="check" className="size-[18px]" /> : <Icon name="edit" className="size-[18px]" />}
                      {editingFacts ? 'Done editing' : 'Edit facts'}
                    </Button>
                  }
                  next={{
                    label: 'Next: Draft alerts',
                    enabled: sheet !== undefined,
                    hint: 'Tick “I checked every fact” to continue.',
                    done: 'Facts confirmed.',
                  }}
                  onGo={openStep}
                >
                  <BulletinReading
                    by={readBy}
                    status={cloudReading.status}
                    now={now}
                    block={cloudBlock}
                    notFound={notFound}
                    unconfirmed={unconfirmed}
                    onRead={() => void readInCloud()}
                  />
                  <FactSheetEditor
                    form={form}
                    onChange={editForm}
                    open={editingFacts ? 'all' : openFactFields(missing)}
                    disabled={busy || reading}
                  />
                  {parsed && !parsed.ok && (
                    <Notice tone="error" role="alert" className="mt-4">
                      <ul className="list-disc pl-4">
                        {parsed.problems.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                    </Notice>
                  )}
                  <label className="mt-4 flex min-h-12 items-center gap-3 border-t border-outline-variant pt-2 text-title-sm">
                    <input
                      type="checkbox"
                      className="size-[18px] accent-primary"
                      checked={confirmed}
                      disabled={!parsed?.ok || busy || reading}
                      onChange={(e) => {
                        setConfirmed(e.target.checked)
                        clearApprovals('unconfirmed')
                      }}
                    />
                    I checked every fact against the bulletin
                  </label>
                </StepCard>
              )}

              {sheet && (
                <StepCard
                  index={2}
                  open={openIndex}
                  title="Draft, check and approve"
                  next={{
                    label: 'Next: Saved alerts',
                    enabled: HOUSEHOLDS.some((h) => drafts.drafts[h.id].approved),
                    hint: 'Approve at least one alert to continue. Translations are made from saved alerts.',
                    done: `${HOUSEHOLDS.filter((h) => drafts.drafts[h.id].approved).length} of ${HOUSEHOLDS.length} approved.`,
                  }}
                  onGo={openStep}
                  onFinish={() => openView('saved')}
                >
                  <AlertBuilder
                    sheet={sheet}
                    area={area}
                    areas={areas}
                    onArea={(next) => {
                      setArea(next)
                      clearApprovals('area')
                    }}
                    drafts={drafts.drafts}
                    claimWords={claimWords}
                    now={now}
                    budgetSeconds={hybrid.tunables?.ondeviceBudgetSeconds ?? 30}
                    cloudModel={hybrid.tunables?.cloudModelName ?? ''}
                    online={hybrid.online}
                    blockReason={blockReason}
                    busy={busy}
                    onDraft={(h) => void drafts.draft(h)}
                    onDraftAll={() => void drafts.draftAll()}
                    onAbandon={drafts.abandon}
                    onCancel={drafts.cancel}
                    onEdit={drafts.edit}
                    saved={savedAlerts.saved?.byId}
                    saveErrors={saveErrors}
                    onApprove={approve}
                    onShowLedger={showLedgerEntry}
                    onTranslate={showSavedAlert}
                  />
                </StepCard>
              )}
            </div>

            <div hidden={view !== 'saved'}>
              <ViewHeading title="Saved alerts">
                One alert per household and area. Withdrawing one keeps its text and its record, marks it withdrawn so residents no
                longer get it or its translations, and adds the reason to the ledger. Approving a new alert for the same household and
                area replaces it, and its translations need publishing again.
              </ViewHeading>
              <SavedAlerts
                saved={savedList}
                unreadable={savedAlerts.saved?.unreadable ?? []}
                error={savedAlerts.error}
                uid={session.uid}
                withdrawErrors={withdrawErrors}
                onWithdraw={withdraw}
                onShowLedger={showLedgerEntry}
                onCreate={() => openStep(openIndex)}
                pick={savedPick}
                onPick={setSavedPick}
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
              <ViewHeading title="Ledger">
                Every approval, withdrawal and published translation is saved with its record: the facts, each model draft and the
                checker’s verdict, any hand edit, and who did it when. Records can’t be changed or deleted, so a new approval or a
                withdrawal changes an alert but not its history.
              </ViewHeading>
              <Ledger
                view={ledger.view}
                error={ledger.error}
                saved={savedAlerts.saved?.byId}
                published={published.published}
                uid={session.uid}
                openId={openEntry}
                onOpen={(id) => go('ledger', id)}
                onCreate={() => openStep(openIndex)}
              />
            </div>
          </div>
        </main>
      </div>

      <Snackbar message={snack} onClose={closeSnack} />

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
              {busy ? 'The test log is ready when the drafts finish.' : 'The test log of prompts, answers and problems appears here after a draft or a cloud reading.'}
            </p>
          )}
        </StatusSection>
      </SystemStatus>
    </>
  )
}

/**
 * One step of creating an alert, shown on its own: its place in the three,
 * its fields, and a footer with Back, a line on where the step stands, and
 * Next. Next stays off until the step is done, and the line says why. The
 * footer never moves when the step changes: what a button did shows in its
 * line, not above it, and from a tablet up the footer stays on screen while
 * a long step scrolls. Hidden steps stay mounted, so a draft keeps streaming
 * and the fields keep their text.
 */
function StepCard({
  index,
  open,
  title,
  action,
  next,
  onGo,
  onFinish,
  children,
}: {
  index: number
  open: number
  title: string
  /** A button beside the title that changes how the step shows, such as "Edit facts". */
  action?: ReactNode
  next: { label: string; enabled: boolean; hint: string; done: string }
  onGo: (index: number) => void
  /** Next on the last step, which leaves the steps. */
  onFinish?: () => void
  children: ReactNode
}) {
  const id = STEP_IDS[index]
  return (
    <section
      id={id}
      hidden={open !== index}
      tabIndex={-1}
      aria-labelledby={`${id}-title`}
      className="rounded-md border border-outline-variant bg-surface-container-lowest outline-none"
    >
      <div className="p-4 sm:p-6 lg:pt-5">
        <div className="mb-4 flex items-end gap-3 lg:mb-3">
          <div className="min-w-0 flex-1">
            <p className="text-label-lg text-primary">Step {index + 1} of 3</p>
            <h2 id={`${id}-title`} className="mt-1 text-title-lg">
              {title}
            </h2>
          </div>
          {action}
        </div>
        {children}
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-b-md border-t border-outline-variant bg-surface-container-lowest px-4 py-3 sm:px-6 md:sticky md:bottom-0 md:z-10 md:flex-nowrap">
        {index > 0 && (
          <Button variant="outlined" onClick={() => onGo(index - 1)}>
            <Icon name="arrow_back" className="size-[18px]" />
            Back
          </Button>
        )}
        <p id={`${id}-status`} role="status" className="min-w-0 flex-1 text-body-md text-on-surface-variant md:text-right">
          {next.enabled ? (
            <span className="inline-flex items-center gap-1.5 text-success">
              <Icon name="check_circle" className="size-[18px]" />
              {next.done}
            </span>
          ) : (
            next.hint
          )}
        </p>
        <Button
          variant="filled"
          disabled={!next.enabled}
          aria-describedby={`${id}-status`}
          onClick={() => (onFinish ? onFinish() : onGo(index + 1))}
        >
          {next.label}
          <Icon name="arrow_forward" className="size-[18px]" />
        </Button>
      </div>
    </section>
  )
}

/** The current view's name, and what it is for when the view doesn't say so itself. */
function ViewHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 lg:mb-4">
      <h1 className="text-headline-sm sm:text-headline-md">{title}</h1>
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

type Route = { view: View; entry: string | undefined }

const routeFromHash = (hash: string): Route => ({ view: viewFromHash(hash), entry: entryFromHash(hash) })

/**
 * The view in the address, and the ledger entry open in it, so the back button
 * and a reload keep them: `#saved`, `#ledger`, `#ledger/<entry>`, or nothing
 * for creating an alert.
 */
function useHashRoute(): [Route, (view: View, entry?: string) => void] {
  const [route, setRoute] = useState(() => routeFromHash(window.location.hash))
  useEffect(() => {
    const sync = () => setRoute(routeFromHash(window.location.hash))
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [])
  function go(view: View, entry?: string) {
    const hash = hashFor(view, entry)
    if (hash === window.location.hash) return
    const { pathname, search } = window.location
    window.history.pushState(null, '', hash || pathname + search)
    setRoute({ view, entry })
  }
  return [route, go]
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
