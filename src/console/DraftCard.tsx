import { useMemo } from 'react'
import { InferenceSource } from '../ai'
import type { SavedAlert } from '../alerts/record'
import type { FactSheet } from '../checker'
import type { Household } from '../drafting/households'
import { formatTime } from './format'
import Problems from './Problems'
import { inReadingOrder } from './segments'
import { checkFor } from '../drafting/check'
import type { Attempt, Draft } from './useDrafts'
import Button, { LinkButton } from '../ui/Button'
import { StatusChip } from '../ui/Chip'
import Notice from '../ui/Notice'

type Props = {
  household: Household
  draft: Draft
  sheet: FactSheet
  area: string
  claimWords: string[]
  now: number
  budgetSeconds: number
  cloudModel: string
  online: boolean
  canDraft: boolean
  onDraft: () => void
  onAbandon: () => void
  onEdit: (text: string) => void
  /** The alert saved for this household and area, if any. */
  saved: SavedAlert | undefined
  saveError: string | undefined
  /** Re-checks and saves the alert (OfficerConsole.approve). */
  onApprove: () => void
  /** Opens the saved alert's entry in the ledger section. */
  onShowLedger: (ledgerId: string) => void
}

/** One household's alert: the attempts, the checked text with highlights, approval and what is saved. */
export default function DraftCard(props: Props) {
  const { household, draft, sheet, area, claimWords, now, budgetSeconds, cloudModel, online } = props
  const result = useMemo(
    () => (draft.text.trim() ? checkFor(draft.text, sheet, area, household, claimWords) : undefined),
    [draft.text, sheet, area, household, claimWords],
  )
  const current = draft.running ? draft.attempts.at(-1) : undefined
  const elapsed = current && current.endedMs === undefined ? now - current.startedAt : 0
  const overBudget = current?.route === 'prefer_on_device' && current.endedMs === undefined && elapsed > budgetSeconds * 1000
  // Once its alert is withdrawn, the card can approve the same text again, e.g. after a withdrawal by mistake.
  const approved = draft.approved && !props.saved?.withdrawn

  return (
    <article aria-label={`${household.label} alert`} className="rounded-md border border-outline-variant p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-title-md">{household.label}</h3>
        <Status running={draft.running} approved={approved} passed={result?.pass} />
        <div className="ml-auto flex gap-2">
          <Button size="sm" onClick={props.onDraft} disabled={!props.canDraft}>
            {draft.attempts.length ? 'Draft again' : 'Draft'}
          </Button>
          <Button size="sm" variant="filled" onClick={props.onApprove} disabled={draft.running || approved || !result?.pass}>
            {approved ? 'Approved' : 'Approve and save'}
          </Button>
        </div>
      </header>

      {draft.attempts.length > 0 && (
        <ol className="mt-3 space-y-1 text-body-sm text-on-surface-variant">
          {draft.attempts.map((a, i) => (
            <li key={a.id}>
              {i + 1}. <SourceBadge attempt={a} cloudModel={cloudModel} /> {attemptText(a, a === current ? elapsed : undefined)}
              {a.passed === false && a.issues && a.issues.length > 0 && (
                <details className="ml-4 mt-1">
                  <summary className="cursor-pointer text-primary underline">Why it failed</summary>
                  <p className="mt-1 whitespace-pre-wrap rounded-sm bg-surface-container-low p-2 text-body-md text-on-surface">{a.text}</p>
                  <ul className="mt-1 list-disc pl-5 text-on-error-container">
                    {inReadingOrder(a.issues).map((issue, j) => (
                      <li key={j}>{issue.message}</li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          ))}
          {draft.edited && <li>Then edited by hand.</li>}
        </ol>
      )}

      {overBudget && (
        <Notice tone="warning" className="mt-3">
          The laptop has taken over {budgetSeconds} s.{' '}
          {online ? <LinkButton onClick={props.onAbandon}>Use the cloud instead</LinkButton> : 'Offline, so it keeps waiting for the laptop.'}
        </Notice>
      )}
      {draft.note && (
        <Notice tone="warning" className="mt-3">
          {draft.note}
        </Notice>
      )}

      <label className="mt-4 block text-body-sm font-medium text-on-surface-variant" htmlFor={`text-${household.id}`}>
        Alert text {draft.running ? '(writing…)' : '(you can edit it; it is re-checked as you type)'}
      </label>
      <textarea
        id={`text-${household.id}`}
        value={draft.text}
        onChange={(e) => props.onEdit(e.target.value)}
        readOnly={draft.running}
        rows={4}
        className="field mt-1"
      />

      {props.saveError && (
        <Notice tone="error" className="mt-3">
          {props.saveError}
        </Notice>
      )}
      {props.saved && <Saved saved={props.saved} current={draft.text.trim()} onShowLedger={props.onShowLedger} />}

      {result && !result.pass && !draft.running && <Problems text={draft.text} issues={result.issues} />}
    </article>
  )
}

/**
 * The saved alert: when, whether it has uploaded, its latest ledger entry, and
 * its text when the card shows something else. A withdrawn alert says so.
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
    <Notice tone={withdrawn ? 'warning' : 'success'} className="mt-3">
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

function Status({ running, approved, passed }: { running: boolean; approved: boolean; passed: boolean | undefined }) {
  if (running) return <StatusChip tone="neutral">Drafting</StatusChip>
  if (approved)
    return (
      <StatusChip tone="success" icon="check_circle">
        Approved
      </StatusChip>
    )
  if (passed === undefined) return <StatusChip tone="neutral">Empty</StatusChip>
  return passed ? (
    <StatusChip tone="success" icon="check_circle">
      Passes the checker
    </StatusChip>
  ) : (
    <StatusChip tone="error" icon="error">
      Fails the checker
    </StatusChip>
  )
}

function SourceBadge({ attempt, cloudModel }: { attempt: Attempt; cloudModel: string }) {
  if (attempt.source === InferenceSource.ON_DEVICE)
    return (
      <StatusChip tone="success" icon="computer">
        Laptop · Gemini Nano
      </StatusChip>
    )
  if (attempt.source === InferenceSource.IN_CLOUD)
    return (
      <StatusChip tone="primary" icon="cloud">
        Cloud · {cloudModel}
      </StatusChip>
    )
  return <StatusChip tone="neutral">{attempt.route === 'only_in_cloud' ? 'Cloud' : 'Laptop or cloud'}</StatusChip>
}

function attemptText(a: Attempt, runningMs: number | undefined): string {
  const kind = a.retry ? 'retry with an edit per problem' : 'draft'
  if (a.endedMs === undefined) return `${kind} · ${((runningMs ?? 0) / 1000).toFixed(0)} s`
  const time = `${(a.endedMs / 1000).toFixed(1)} s`
  if (a.abandoned) return `${kind} · stopped waiting after ${time}`
  if (a.error) return `${kind} · error after ${time}: ${a.error}`
  if (a.passed === undefined) return `${kind} · ${time}`
  return `${kind} · ${time} · ${a.passed ? 'passed' : `failed (${a.issues?.length ?? 0} problem${a.issues?.length === 1 ? '' : 's'})`}`
}
