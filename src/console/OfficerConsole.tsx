import { useEffect, useMemo, useState } from 'react'
import { canPrepare, describeDeviceStatus } from '../ai/deviceStatus'
import { alertDocId, approvedAlert, areaKey, type SavedAlert } from '../alerts/record'
import { newLedgerId, saveApprovedAlert, withdrawAlert } from '../alerts/store'
import { withdrawalWrites } from '../ledger/record'
import { SAMPLE_BULLETIN } from '../factsheet/sample'
import { fromForm, toForm, type FactSheetForm } from '../factsheet/form'
import { parseBulletin } from '../factsheet/parse'
import { HOUSEHOLDS, type Household, type HouseholdId } from '../drafting/households'
import type { OfficerSession } from '../officer/OfficerGate'
import { unrecordedDrafts, writtenBy } from './approval'
import DraftCard from './DraftCard'
import FactSheetEditor from './FactSheetEditor'
import Ledger from './Ledger'
import SavedAlerts from './SavedAlerts'
import { attemptLog } from './log'
import { useDrafts } from './useDrafts'
import { useHybrid } from './useHybrid'
import { useLedger } from './useLedger'
import { useSavedAlerts } from './useSavedAlerts'
import { usePublishedTranslations, useTranslations } from './useTranslations'
import Button from '../ui/Button'
import Card from '../ui/Card'
import Notice from '../ui/Notice'

/**
 * The officer console: bulletin in, fact sheet confirmed, drafts checked,
 * approved and saved; the saved alerts, where one can be translated or
 * withdrawn; and the ledger.
 */
export default function OfficerConsole({ session }: { session: OfficerSession }) {
  const hybrid = useHybrid()
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

  return (
    <div className="mt-6 space-y-6">
      <Card title="Models">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-body-md">
          <dt className="font-medium">On this laptop</dt>
          <dd className="text-on-surface-variant">
            {describeDeviceStatus(hybrid.device)}
            {hybrid.warmUp.state === 'warming' && ` · warming up (${((now - hybrid.warmUp.startedAt) / 1000).toFixed(0)} s)`}
            {hybrid.warmUp.state === 'warm' &&
              ` · ${hybrid.warmUp.source === 'in_cloud' ? 'warm-up answered from the cloud' : 'warmed up'} in ${hybrid.warmUp.seconds.toFixed(1)} s`}
            {hybrid.warmUp.state === 'failed' && ` · warm-up failed: ${hybrid.warmUp.error}`}
            {canPrepare(hybrid.device) && hybrid.models && (
              <Button size="sm" variant="tonal" onClick={() => void hybrid.prepare()} disabled={hybrid.download !== undefined} className="ml-3">
                {hybrid.download === undefined ? 'Prepare on-device model' : `Downloading ${Math.round(hybrid.download * 100)}%`}
              </Button>
            )}
          </dd>
          <dt className="font-medium">Cloud</dt>
          <dd className="text-on-surface-variant">
            {!hybrid.configured
              ? 'Not configured: you can still write and check alerts by hand'
              : hybrid.online
                ? `Online · ${hybrid.tunables?.cloudModelName ?? 'loading'}`
                : 'Offline: only the laptop model can draft'}
          </dd>
        </dl>
      </Card>

      <Card title="1. Bulletin">
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
        <Card title="2. Fact sheet">
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
        <Card title="3. Draft, check and approve">
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
                onShowLedger={setOpenEntry}
              />
            ))}
          </div>
          {HOUSEHOLDS.some((h) => drafts.drafts[h.id].attempts.length > 0) && !busy && (
            <TestLog
              text={attemptLog(HOUSEHOLDS, drafts.drafts, {
                area,
                cloudModel: hybrid.tunables?.cloudModelName ?? 'none',
                device: hybrid.device,
                warmUp:
                  hybrid.warmUp.state === 'warm'
                    ? `warmed up in ${hybrid.warmUp.seconds.toFixed(1)} s (${hybrid.warmUp.source ?? 'unknown source'})`
                    : `warm-up ${hybrid.warmUp.state}`,
              })}
            />
          )}
        </Card>
      )}

      <Card title="4. Saved alerts and translations">
        <SavedAlerts
          saved={savedList}
          unreadable={savedAlerts.saved?.unreadable ?? []}
          error={savedAlerts.error}
          uid={session.uid}
          withdrawErrors={withdrawErrors}
          onWithdraw={withdraw}
          onShowLedger={setOpenEntry}
          translations={{
            published: published.published,
            error: published.error,
            actions: translations,
            canTranslate: Boolean(hybrid.translationModel && hybrid.online),
            claimWords,
            translationClaims: hybrid.tunables?.translationClaims,
          }}
        />
      </Card>

      <Card title="5. Ledger">
        <Ledger
          view={ledger.view}
          error={ledger.error}
          saved={savedAlerts.saved?.byId}
          published={published.published}
          uid={session.uid}
          openId={openEntry}
          onOpen={setOpenEntry}
        />
      </Card>
    </div>
  )
}

/** Every attempt as plain text, to paste into the thread or a PR. */
function TestLog({ text }: { text: string }) {
  const [copiedText, setCopiedText] = useState('')
  const copied = copiedText === text
  return (
    <div className="mt-6 text-body-md">
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
