import { useEffect, useMemo, useState } from 'react'
import { canPrepare, describeDeviceStatus } from '../ai/deviceStatus'
import { alertDocId, approvedAlert, areaKey } from '../alerts/record'
import { saveApprovedAlert } from '../alerts/store'
import { SAMPLE_BULLETIN } from '../factsheet/sample'
import { fromForm, toForm, type FactSheetForm } from '../factsheet/form'
import { parseBulletin } from '../factsheet/parse'
import { HOUSEHOLDS, type Household, type HouseholdId } from '../drafting/households'
import type { OfficerSession } from '../officer/OfficerGate'
import { unrecordedDrafts, writtenBy } from './approval'
import DraftCard from './DraftCard'
import FactSheetEditor from './FactSheetEditor'
import Ledger from './Ledger'
import { attemptLog } from './log'
import { useDrafts } from './useDrafts'
import { useHybrid } from './useHybrid'
import { useLedger } from './useLedger'
import { useSavedAlerts } from './useSavedAlerts'

/** The officer console: bulletin in, fact sheet confirmed, drafts checked, approved and saved, and the ledger. */
export default function OfficerConsole({ session }: { session: OfficerSession }) {
  const hybrid = useHybrid()
  const savedAlerts = useSavedAlerts(session.db)
  const ledger = useLedger(session.db)
  const [openEntry, setOpenEntry] = useState<string>()
  const savedLedgerIds = useMemo(
    () => (savedAlerts.saved ? new Map([...savedAlerts.saved.byId].map(([id, a]) => [id, a.ledgerId])) : undefined),
    [savedAlerts.saved],
  )
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
      <Section title="Models">
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="font-medium">On this laptop</dt>
          <dd className="text-slate-700">
            {describeDeviceStatus(hybrid.device)}
            {hybrid.warmUp.state === 'warming' && ` · warming up (${((now - hybrid.warmUp.startedAt) / 1000).toFixed(0)} s)`}
            {hybrid.warmUp.state === 'warm' &&
              ` · ${hybrid.warmUp.source === 'in_cloud' ? 'warm-up answered from the cloud' : 'warmed up'} in ${hybrid.warmUp.seconds.toFixed(1)} s`}
            {hybrid.warmUp.state === 'failed' && ` · warm-up failed: ${hybrid.warmUp.error}`}
            {canPrepare(hybrid.device) && hybrid.models && (
              <button
                type="button"
                onClick={() => void hybrid.prepare()}
                disabled={hybrid.download !== undefined}
                className="ml-3 rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium hover:bg-slate-100 disabled:opacity-50"
              >
                {hybrid.download === undefined ? 'Prepare on-device model' : `Downloading ${Math.round(hybrid.download * 100)}%`}
              </button>
            )}
          </dd>
          <dt className="font-medium">Cloud</dt>
          <dd className="text-slate-700">
            {!hybrid.configured
              ? 'Not configured: you can still write and check alerts by hand'
              : hybrid.online
                ? `Online · ${hybrid.tunables?.cloudModelName ?? 'loading'}`
                : 'Offline: only the laptop model can draft'}
          </dd>
        </dl>
      </Section>

      <Section title="1. Bulletin">
        <label className="block text-sm font-medium" htmlFor="bulletin">
          Paste the storm bulletin
        </label>
        <textarea
          id="bulletin"
          value={bulletin}
          onChange={(e) => setBulletin(e.target.value)}
          rows={6}
          className="mt-1 w-full rounded border border-slate-300 p-2 font-mono text-xs"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => readBulletin(bulletin)}
            disabled={bulletin.trim() === '' || busy}
            className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Read bulletin
          </button>
          <button
            type="button"
            onClick={() => readBulletin(SAMPLE_BULLETIN)}
            disabled={busy}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
          >
            Use the demo bulletin
          </button>
        </div>
      </Section>

      {form && (
        <Section title="2. Fact sheet">
          {notFound.length > 0 && (
            <p className="mb-3 rounded bg-amber-100 p-2 text-sm text-amber-950">
              Not found in the bulletin: {notFound.join(', ')}. Fill these in if the bulletin has them.
            </p>
          )}
          <FactSheetEditor form={form} onChange={editForm} disabled={busy} />
          {parsed && !parsed.ok && (
            <ul className="mt-3 list-disc pl-5 text-sm text-red-700">
              {parsed.problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <label className="mt-3 flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={!parsed?.ok || busy}
              onChange={(e) => {
                setConfirmed(e.target.checked)
                drafts.unapproveAll()
              }}
            />
            I checked every fact against the bulletin
          </label>
        </Section>
      )}

      {sheet && (
        <Section title="3. Draft, check and approve">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium">
              Area
              <select
                value={area}
                onChange={(e) => {
                  setArea(e.target.value)
                  drafts.unapproveAll()
                }}
                disabled={busy}
                className="ml-2 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
              >
                {areas.map((a) => (
                  <option key={a}>{a}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void drafts.draftAll()}
              disabled={!canDraft}
              className="rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Draft all four
            </button>
          </div>
          {savedAlerts.error && (
            <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-800">Couldn’t read the saved alerts: {savedAlerts.error}</p>
          )}
          {savedAlerts.saved && savedAlerts.saved.unreadable.length > 0 && (
            <p className="mt-3 rounded bg-amber-100 p-2 text-sm text-amber-950">
              These saved documents aren’t alerts this app can read: {savedAlerts.saved.unreadable.join(', ')}.
            </p>
          )}
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
        </Section>
      )}

      <Section title="4. Ledger">
        <Ledger
          view={ledger.view}
          error={ledger.error}
          savedLedgerIds={savedLedgerIds}
          uid={session.uid}
          openId={openEntry}
          onOpen={setOpenEntry}
        />
      </Section>
    </div>
  )
}

/** Every attempt as plain text, to paste into the thread or a PR. */
function TestLog({ text }: { text: string }) {
  const [copiedText, setCopiedText] = useState('')
  const copied = copiedText === text
  return (
    <div className="mt-4 text-sm">
      <button
        type="button"
        onClick={() =>
          navigator.clipboard.writeText(text).then(
            () => setCopiedText(text),
            () => setCopiedText(''),
          )
        }
        className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-100"
      >
        {copied ? 'Copied: paste it into the chat' : 'Copy test log'}
      </button>
      <details className="mt-2">
        <summary className="cursor-pointer text-slate-700">Show the test log (prompts, answers and problems)</summary>
        <textarea readOnly value={text} rows={12} className="mt-2 w-full rounded border border-slate-300 p-2 font-mono text-xs" />
      </details>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      {children}
    </section>
  )
}
