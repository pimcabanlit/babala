import { useMemo } from 'react'
import { InferenceSource } from '../ai'
import type { SavedAlert } from '../alerts/record'
import type { FactSheet, Rule } from '../checker'
import type { Household } from '../drafting/households'
import { formatTime } from './format'
import { inReadingOrder, segments } from './segments'
import { checkFor } from '../drafting/check'
import type { Attempt, Draft } from './useDrafts'

const RULE_LABEL: Record<Rule, string> = {
  figures: 'Figure',
  places: 'Place',
  missing: 'Missing',
  placeholders: 'Placeholder',
  'added-claims': 'Added claim',
  plain: 'Style',
  translation: 'Translation',
}

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

  return (
    <article aria-label={`${household.label} alert`} className="rounded border border-slate-200 p-3">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{household.label}</h3>
        <Status draft={draft} passed={result?.pass} />
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={props.onDraft}
            disabled={!props.canDraft}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-100 disabled:opacity-50"
          >
            {draft.attempts.length ? 'Draft again' : 'Draft'}
          </button>
          <button
            type="button"
            onClick={props.onApprove}
            disabled={draft.running || draft.approved || !result?.pass}
            className="rounded bg-emerald-700 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-600 disabled:bg-slate-300"
          >
            {draft.approved ? 'Approved' : 'Approve and save'}
          </button>
        </div>
      </header>

      {draft.attempts.length > 0 && (
        <ol className="mt-2 space-y-0.5 text-xs text-slate-600">
          {draft.attempts.map((a, i) => (
            <li key={a.id}>
              {i + 1}. <SourceBadge attempt={a} cloudModel={cloudModel} /> {attemptText(a, a === current ? elapsed : undefined)}
              {a.passed === false && a.issues && a.issues.length > 0 && (
                <details className="ml-4 mt-1">
                  <summary className="cursor-pointer text-slate-700 underline">Why it failed</summary>
                  <p className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-2 text-sm text-slate-800">{a.text}</p>
                  <ul className="mt-1 list-disc pl-5 text-red-800">
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
        <p className="mt-2 rounded bg-amber-100 p-2 text-sm">
          The laptop has taken over {budgetSeconds} s.{' '}
          {online ? (
            <button type="button" onClick={props.onAbandon} className="font-semibold underline">
              Use the cloud instead
            </button>
          ) : (
            'Offline, so it keeps waiting for the laptop.'
          )}
        </p>
      )}
      {draft.note && <p className="mt-2 rounded bg-amber-100 p-2 text-sm">{draft.note}</p>}

      <label className="mt-3 block text-xs font-medium text-slate-500" htmlFor={`text-${household.id}`}>
        Alert text {draft.running ? '(writing…)' : '(you can edit it; it is re-checked as you type)'}
      </label>
      <textarea
        id={`text-${household.id}`}
        value={draft.text}
        onChange={(e) => props.onEdit(e.target.value)}
        readOnly={draft.running}
        rows={4}
        className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
      />

      {props.saveError && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-800">{props.saveError}</p>}
      {props.saved && <Saved saved={props.saved} current={draft.text.trim()} onShowLedger={props.onShowLedger} />}

      {result && !result.pass && !draft.running && (
        <div className="mt-2">
          <p className="whitespace-pre-wrap rounded bg-slate-50 p-2 text-sm leading-6">
            {segments(draft.text, result.issues).map((s, i) =>
              s.issue ? (
                <mark key={i} title={s.issue.message} className="rounded bg-red-200 px-0.5 text-red-950">
                  {s.text}
                </mark>
              ) : (
                <span key={i}>{s.text}</span>
              ),
            )}
          </p>
          {result.issues.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-sm text-red-800">
              {inReadingOrder(result.issues).map((issue, i) => (
                <li key={i}>
                  <span className="font-semibold">{RULE_LABEL[issue.rule]}:</span> {issue.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  )
}

/** The saved alert: when, whether it has uploaded, its ledger entry, and its text when the card shows something else. */
function Saved({ saved, current, onShowLedger }: { saved: SavedAlert; current: string; onShowLedger: (ledgerId: string) => void }) {
  const when = saved.approvedAt ? ` at ${formatTime(saved.approvedAt)}` : ''
  const { ledgerId } = saved
  return (
    <div className="mt-2 rounded border border-emerald-200 bg-emerald-50 p-2 text-sm text-emerald-950">
      <p>
        {saved.pending
          ? `Saved on this laptop${when}. It uploads when the laptop is back online.`
          : `Saved online${when}.`}{' '}
        {ledgerId ? (
          <button type="button" onClick={() => onShowLedger(ledgerId)} className="font-semibold underline">
            See its ledger entry
          </button>
        ) : (
          'Saved before the ledger, so it has no entry.'
        )}
      </p>
      {saved.text !== current && (
        <>
          <p className="mt-1 text-emerald-900">The saved alert stays until you approve a new one:</p>
          <blockquote className="mt-1 whitespace-pre-wrap border-l-4 border-emerald-300 pl-2">{saved.text}</blockquote>
        </>
      )}
    </div>
  )
}

function Status({ draft, passed }: { draft: Draft; passed: boolean | undefined }) {
  const [label, style] = draft.running
    ? ['Drafting', 'bg-slate-200 text-slate-800']
    : draft.approved
      ? ['Approved', 'bg-emerald-700 text-white']
      : passed === undefined
        ? ['Empty', 'bg-slate-100 text-slate-600']
        : passed
          ? ['Passes the checker', 'bg-emerald-100 text-emerald-900']
          : ['Fails the checker', 'bg-red-100 text-red-900']
  return <span className={`rounded px-2 py-0.5 text-xs font-semibold ${style}`}>{label}</span>
}

function SourceBadge({ attempt, cloudModel }: { attempt: Attempt; cloudModel: string }) {
  if (attempt.source === InferenceSource.ON_DEVICE)
    return <span className="rounded bg-emerald-100 px-1.5 font-semibold text-emerald-900">Laptop · Gemini Nano</span>
  if (attempt.source === InferenceSource.IN_CLOUD)
    return <span className="rounded bg-sky-100 px-1.5 font-semibold text-sky-900">Cloud · {cloudModel}</span>
  return (
    <span className="rounded bg-slate-200 px-1.5 font-semibold text-slate-700">
      {attempt.route === 'only_in_cloud' ? 'Cloud' : 'Laptop or cloud'}
    </span>
  )
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
