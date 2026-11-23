import { useEffect, useRef } from 'react'
import { InferenceSource } from '../ai'
import type { SavedAlert } from '../alerts/record'
import type { CheckResult as Checked } from '../checker'
import type { Household } from '../drafting/households'
import { writtenBy } from './approval'
import { DRAFT_CHECKS, attemptError, attemptText, historySummary, isBusyError, progressText, tabStatus, type TabStatus } from './create'
import { formatTime } from './format'
import Problems from './Problems'
import type { Attempt, Draft } from './useDrafts'
import Button, { LinkButton } from '../ui/Button'
import { StatusChip, type Tone } from '../ui/Chip'
import Icon, { type IconName } from '../ui/Icon'
import Notice from '../ui/Notice'
import Progress from '../ui/Progress'

type Props = {
  household: Household
  draft: Draft
  /** The six checks on the text shown, or undefined while it is empty. */
  result: Checked | undefined
  now: number
  budgetSeconds: number
  cloudModel: string
  online: boolean
  canDraft: boolean
  /** The element that says why drafting is off, for the Draft button's description. */
  blockReasonId: string | undefined
  onDraft: () => void
  onAbandon: () => void
  /** Stops the draft in progress, and the rest of "Draft all four". */
  onCancel: () => void
  onEdit: (text: string) => void
  /** The alert saved for this household and area, if any. */
  saved: SavedAlert | undefined
  saveError: string | undefined
  /** Re-checks and saves the alert (OfficerConsole.approve). */
  onApprove: () => void
  /** Opens the saved alert's entry in the ledger. */
  onShowLedger: (ledgerId: string) => void
  /** Opens the saved alert under *Saved alerts*, where it is translated. */
  onTranslate: (alertId: string) => void
}

/**
 * One household's alert, shown under its tab: which model is writing it, the
 * text as it streams in and then as the officer edits it, the six checks,
 * approval and what is saved, and a folded history of every attempt.
 */
export default function DraftPanel(props: Props) {
  const { household, draft, result, now, budgetSeconds, cloudModel, online, saved } = props
  const current = draft.running ? draft.attempts.at(-1) : undefined
  const elapsed = current && current.endedMs === undefined ? now - current.startedAt : 0
  const overBudget = current?.route === 'prefer_on_device' && current.endedMs === undefined && elapsed > budgetSeconds * 1000
  // Once its alert is withdrawn, the panel can approve the same text again, e.g. after a withdrawal by mistake.
  const approved = draft.approved && !saved?.withdrawn
  const status = tabStatus({ running: draft.running, approved, passed: result?.pass })
  const lastError = draft.running ? undefined : draft.attempts.at(-1)?.error
  // Every call in this round erred or was stopped, so there are no words to fix and the routing's note would mislead.
  const nothingWritten =
    !draft.running && draft.attempts.length > 0 && draft.attempts.every((a) => a.error || a.abandoned || a.cancelled || !a.text.trim())
  const helpId = `text-help-${household.id}`
  const focusDraft = useRef(false)

  // The Cancel button goes away with the draft, so focus moves to Draft again rather than to the page.
  useEffect(() => {
    if (draft.running || !focusDraft.current) return
    focusDraft.current = false
    document.getElementById(`draft-${household.id}`)?.focus()
  }, [draft.running, household.id])

  function cancel() {
    focusDraft.current = true
    props.onCancel()
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <h3 className="min-w-0 flex-1 pt-0.5">
          <span className="text-title-md">{household.label}</span>
          <span className="text-body-md text-on-surface-variant"> · for {household.audience}</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          <PanelStatus status={status} />
          <WrittenBy draft={draft} running={current} cloudModel={cloudModel} />
        </div>
      </header>

      {current && (
        <div>
          <Progress label={`Drafting the ${household.label} alert`} />
          {/* Cancel sits here, not in the place of Draft again, so a click as the draft ends never starts a new one. */}
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4">
            <p className="text-body-md text-on-surface-variant">
              <span role="status">{progressText(current)}</span> · {Math.floor(elapsed / 1000)} s
            </p>
            <Button variant="text" onClick={cancel}>
              <Icon name="close" className="size-[18px]" />
              Cancel
            </Button>
          </div>
        </div>
      )}
      {overBudget && (
        <Notice tone="warning">
          The laptop has taken over {budgetSeconds} s.{' '}
          {online ? <LinkButton onClick={props.onAbandon}>Use the cloud instead</LinkButton> : 'Offline, so it keeps waiting for the laptop.'}
        </Notice>
      )}
      {draft.cancelled && !draft.running && (
        <Notice tone="neutral" role="status">
          {draft.text.trim()
            ? 'Drafting cancelled. The last full draft is below: fix it by hand, or draft again.'
            : 'Drafting cancelled. Draft again, or write the alert by hand.'}
        </Notice>
      )}
      {draft.note && (
        <Notice tone="warning">{nothingWritten ? 'No model wrote a draft this time. Draft again, or write the alert by hand.' : draft.note}</Notice>
      )}
      {lastError && (
        <Notice tone="error">{isBusyError(lastError) ? attemptError(lastError) : `The last try didn’t answer: ${lastError}`}</Notice>
      )}

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4">
          <label className="text-title-sm" htmlFor={`text-${household.id}`}>
            Alert text
          </label>
          <p id={helpId} className="text-body-sm text-on-surface-variant">
            {draft.running ? 'Writing…' : 'You can edit it. It’s re-checked as you type.'}
          </p>
        </div>
        <textarea
          id={`text-${household.id}`}
          value={draft.text}
          onChange={(e) => props.onEdit(e.target.value)}
          readOnly={draft.running}
          aria-describedby={helpId}
          rows={4}
          // Room for the steps' sticky footer when a draft brings it into view (AlertBuilder).
          className="field mt-1 scroll-mt-4 scroll-mb-24"
        />
      </div>

      {result && !draft.running && <CheckResult text={draft.text} result={result} />}

      {props.saveError && <Notice tone="error">{props.saveError}</Notice>}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button id={`draft-${household.id}`} variant="outlined" onClick={props.onDraft} disabled={!props.canDraft} aria-describedby={props.blockReasonId}>
          {draft.attempts.length ? 'Draft again' : 'Draft'}
        </Button>
        <Button variant="filled" onClick={props.onApprove} disabled={draft.running || approved || !result?.pass}>
          {approved && <Icon name="check" className="size-[18px]" />}
          {approved ? 'Approved' : 'Approve and save'}
        </Button>
      </div>

      {saved && <Saved saved={saved} current={draft.text.trim()} onShowLedger={props.onShowLedger} />}
      {saved && approved && (
        <Button variant="tonal" onClick={() => props.onTranslate(saved.id)}>
          <Icon name="translate" className="size-[18px]" />
          Next: translate into Filipino and Cebuano
        </Button>
      )}

      {draft.attempts.length > 0 && <History draft={draft} current={current} elapsed={elapsed} cloudModel={cloudModel} />}
    </div>
  )
}

const STATUS: Record<TabStatus, { tone: Tone; icon?: IconName; text: string }> = {
  empty: { tone: 'neutral', text: 'Not drafted' },
  drafting: { tone: 'primary', icon: 'progress_activity', text: 'Drafting' },
  fails: { tone: 'error', icon: 'error', text: 'Fails a check' },
  passes: { tone: 'success', icon: 'check', text: 'Passes, not approved' },
  approved: { tone: 'success', icon: 'check_circle', text: 'Approved' },
}

function PanelStatus({ status }: { status: TabStatus }) {
  const { tone, icon, text } = STATUS[status]
  return (
    <StatusChip tone={tone} icon={icon}>
      {text}
    </StatusChip>
  )
}

/** Which model wrote the text shown: the one streaming now, or the last that finished with text, and any hand edit. */
function WrittenBy({ draft, running, cloudModel }: { draft: Draft; running: Attempt | undefined; cloudModel: string }) {
  const by = running ? sourceOf(running) : writtenBy(draft)
  return (
    <>
      {by === 'on_device' && (
        <StatusChip tone="success" icon="computer">
          On this laptop · Gemini Nano
        </StatusChip>
      )}
      {by === 'in_cloud' && (
        <StatusChip tone="primary" icon="cloud">
          {cloudModel ? `Cloud · ${cloudModel}` : 'Cloud'}
        </StatusChip>
      )}
      {by === 'unknown' && !running && <StatusChip tone="neutral">Laptop or cloud</StatusChip>}
      {draft.edited && !running && (
        <StatusChip tone="neutral" icon="edit">
          {by === 'none' ? 'Written by hand' : 'Edited by hand'}
        </StatusChip>
      )}
    </>
  )
}

function sourceOf(a: Attempt): 'on_device' | 'in_cloud' | 'unknown' {
  if (a.source === InferenceSource.ON_DEVICE) return 'on_device'
  if (a.source === InferenceSource.IN_CLOUD) return 'in_cloud'
  return 'unknown'
}

/** The six checks: all passed, or each problem highlighted in the text and listed with its check. */
function CheckResult({ text, result }: { text: string; result: Checked }) {
  if (result.pass)
    return (
      <div className="rounded-md bg-success-container p-3 text-on-success-container">
        <p className="flex items-center gap-2 text-title-sm">
          <Icon name="check_circle" className="size-5" />
          Passed all {DRAFT_CHECKS.length} checks
        </p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-7 text-body-md">
          {DRAFT_CHECKS.map((c) => (
            <li key={c.rule} className="flex items-center gap-1">
              <Icon name="check" className="size-4" />
              {c.label}
            </li>
          ))}
        </ul>
      </div>
    )
  const n = result.issues.length
  return (
    <div className="rounded-md border border-error p-3">
      <p className="flex items-center gap-2 text-title-sm text-error">
        <Icon name="error" className="size-5" />
        {n} {n === 1 ? 'problem' : 'problems'} to fix before you can approve it
      </p>
      <Problems text={text} issues={result.issues} />
    </div>
  )
}

/**
 * The saved alert: when, whether it has uploaded, its latest ledger entry, and
 * its text when the panel shows something else. A withdrawn alert says so.
 */
function Saved({ saved, current, onShowLedger }: { saved: SavedAlert; current: string; onShowLedger: (ledgerId: string) => void }) {
  const { withdrawn } = saved
  const at = withdrawn ? withdrawn.at : saved.approvedAt
  const when = at ? ` at ${formatTime(at)}` : ''
  const entryId = withdrawn?.ledgerId ?? saved.ledgerId
  const state = withdrawn
    ? `Withdrawn${when}${saved.pending ? ' on this laptop, uploading when it is back online' : ''}. Residents no longer get it. Approve a new alert to replace it.`
    : saved.pending
      ? `Saved on this laptop${when}. It uploads when the laptop is back online.`
      : `Saved online${when}.`
  return (
    <Notice tone={withdrawn ? 'warning' : 'success'}>
      <p>
        {state}{' '}
        {entryId ? (
          <LinkButton onClick={() => onShowLedger(entryId)}>See its ledger entry</LinkButton>
        ) : (
          'Saved before the ledger, so it has no entry.'
        )}
      </p>
      {saved.text !== current &&
        (withdrawn ? (
          <>
            <p className="mt-1">The withdrawn alert:</p>
            <blockquote className="mt-1 whitespace-pre-wrap border-l-4 border-warning pl-3 line-through">{saved.text}</blockquote>
          </>
        ) : (
          <>
            <p className="mt-1">The saved alert stays until you approve a new one:</p>
            <blockquote className="mt-1 whitespace-pre-wrap border-l-4 border-success pl-3">{saved.text}</blockquote>
          </>
        ))}
    </Notice>
  )
}

/** Every attempt in this round, folded to one line: the model, the time, the verdict and why it failed. */
function History({ draft, current, elapsed, cloudModel }: { draft: Draft; current: Attempt | undefined; elapsed: number; cloudModel: string }) {
  return (
    <details className="group rounded-md border border-outline-variant">
      <summary className="flex min-h-12 cursor-pointer items-center gap-2 rounded-md px-4 py-2 text-body-md hover:bg-on-surface/8 [&::-webkit-details-marker]:hidden">
        <Icon name="history" className="size-5 text-on-surface-variant" />
        <span className="text-title-sm">History</span>
        <span className="min-w-0 flex-1 text-on-surface-variant">
          {historySummary(draft.attempts)}
          {draft.edited && ', then edited by hand'}
        </span>
        <Icon name="expand_more" className="size-6 text-on-surface-variant transition-transform duration-150 group-open:rotate-180" />
      </summary>
      <ol className="space-y-3 border-t border-outline-variant px-4 py-3 text-body-md">
        {draft.attempts.map((a, i) => (
          <li key={a.id}>
            <p className="flex flex-wrap items-center gap-2">
              <span className="text-on-surface-variant">{i + 1}.</span>
              <AttemptSource attempt={a} cloudModel={cloudModel} />
              <span>{attemptText(a, a === current ? elapsed : undefined)}</span>
            </p>
            {a.passed === false && a.issues && a.issues.length > 0 && (
              <details className="mt-1 ml-5">
                <summary className="inline-flex min-h-12 cursor-pointer items-center font-medium text-primary underline underline-offset-2">
                  Why it failed
                </summary>
                <Problems text={a.text} issues={a.issues} />
              </details>
            )}
          </li>
        ))}
        {draft.edited && <li className="text-on-surface-variant">Then edited by hand.</li>}
      </ol>
    </details>
  )
}

function AttemptSource({ attempt, cloudModel }: { attempt: Attempt; cloudModel: string }) {
  const by = sourceOf(attempt)
  if (by === 'on_device')
    return (
      <StatusChip tone="success" icon="computer">
        Laptop · Gemini Nano
      </StatusChip>
    )
  if (by === 'in_cloud')
    return (
      <StatusChip tone="primary" icon="cloud">
        Cloud{cloudModel ? ` · ${cloudModel}` : ''}
      </StatusChip>
    )
  return <StatusChip tone="neutral">{attempt.route === 'only_in_cloud' ? 'Cloud' : 'Laptop or cloud'}</StatusChip>
}
