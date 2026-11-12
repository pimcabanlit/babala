import { useEffect, useRef } from 'react'
import { to12h } from '../factsheet/form'
import { HOUSEHOLDS } from '../drafting/households'
import { LEDGER_PAGE, type LedgerView } from '../ledger/store'
import type { LedgerEntry } from '../ledger/record'
import { formatTime } from './format'
import { approverLabel, draftLine, entryStatus, writerLabel, type EntryStatus } from './ledgerView'

type Props = {
  view: LedgerView | undefined
  error: string | undefined
  /** Each saved alert's ID and the ledger entry it points at; undefined while loading. */
  savedLedgerIds: ReadonlyMap<string, string | undefined> | undefined
  uid: string
  /** The entry to show open, e.g. after "See its ledger entry" on a card. */
  openId: string | undefined
  onOpen: (id: string | undefined) => void
}

/** The latest approvals, newest first. Each opens into its trace from the bulletin to the saved alert. */
export default function Ledger({ view, error, savedLedgerIds, uid, openId, onOpen }: Props) {
  return (
    <div className="space-y-2 text-sm">
      <p className="text-slate-700">
        Every approval is saved with its record: the facts, each model draft and the checker’s verdict, any hand edit, and who
        approved it when. Records can’t be changed or deleted, so a new approval replaces an alert but not its history.
      </p>
      {error && <p className="rounded bg-red-50 p-2 text-red-800">Couldn’t read the ledger: {error}</p>}
      {!view && !error && <p className="text-slate-600">Loading the ledger…</p>}
      {view && view.entries.length === 0 && <p className="text-slate-600">No approvals yet.</p>}
      {view && view.unreadable.length > 0 && (
        <p className="rounded bg-amber-100 p-2 text-amber-950">
          These ledger documents aren’t entries this app can read: {view.unreadable.join(', ')}.
        </p>
      )}
      {view && view.entries.length >= LEDGER_PAGE && <p className="text-slate-600">Showing the latest {LEDGER_PAGE} entries.</p>}
      <ol className="space-y-2">
        {view?.entries.map((entry) => (
          <li key={entry.id}>
            <Entry
              entry={entry}
              status={entryStatus(entry, savedLedgerIds)}
              uid={uid}
              open={entry.id === openId}
              onToggle={(open) => onOpen(open ? entry.id : undefined)}
            />
          </li>
        ))}
      </ol>
    </div>
  )
}

function Entry({
  entry,
  status,
  uid,
  open,
  onToggle,
}: {
  entry: LedgerEntry
  status: EntryStatus
  uid: string
  open: boolean
  onToggle: (open: boolean) => void
}) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [open])
  const household = HOUSEHOLDS.find((h) => h.id === entry.household)?.label ?? entry.household
  const sheet = entry.factSheet
  const centres = sheet.evacuationCentres.join(', ')

  return (
    <details
      ref={ref}
      id={`ledger-${entry.id}`}
      open={open}
      onToggle={(e) => {
        // Only report a change the officer made, not the one React just rendered.
        if (e.currentTarget.open !== open) onToggle(e.currentTarget.open)
      }}
      className="rounded border border-slate-200 p-2"
    >
      <summary className="cursor-pointer">
        <span className="font-medium">
          {entry.at ? formatTime(entry.at) : 'Time pending'} · Approved · {household} · {entry.area}
        </span>{' '}
        <StatusBadge status={status} pending={entry.pending} />
      </summary>

      <ol className="mt-3 space-y-3 border-l-2 border-slate-200 pl-3">
        <Step title="Bulletin and confirmed facts">
          <p>
            {sheet.stormName || 'Storm name not given'} · Signal No. {entry.signal} over {entry.area} · landfall at{' '}
            {to12h(sheet.landfallTime)}
            {sheet.landfallDate ? ` on ${sheet.landfallDate}` : ''} · evacuate to {centres}
            {sheet.hotline ? ` · hotline ${sheet.hotline}` : ''}
          </p>
          <details className="mt-1">
            <summary className="cursor-pointer text-slate-700 underline">Show the bulletin</summary>
            <pre className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-2 font-mono text-xs">{sheet.bulletinText}</pre>
          </details>
        </Step>

        <Step title="Drafts and checks">
          {entry.draftsOmitted > 0 && (
            <p className="text-slate-600">
              {entry.draftsOmitted} older draft{entry.draftsOmitted === 1 ? '' : 's'} left out to keep the record small.
            </p>
          )}
          {entry.drafts.length === 0 ? (
            <p className="text-slate-600">
              {entry.source === 'none'
                ? 'No model drafted this alert: the officer typed it.'
                : 'No new model drafts since this card’s last approval. The earlier entry for this alert has them.'}
            </p>
          ) : (
            <ol className="space-y-2">
              {entry.drafts.map((d, i) => (
                <li key={i}>
                  <p className="font-medium">
                    {draftLine(d, entry.cloudModel)}
                    {d.area !== entry.area && <span className="font-normal text-slate-600"> · drafted for {d.area}</span>}
                  </p>
                  {d.text && <blockquote className="mt-1 whitespace-pre-wrap border-l-4 border-slate-300 pl-2 text-slate-800">{d.text}</blockquote>}
                  {d.issues.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-red-800">
                      {d.issues.map((issue, j) => (
                        <li key={j}>{issue.message}</li>
                      ))}
                    </ul>
                  )}
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-slate-600 underline">Show the prompt</summary>
                    <pre className="mt-1 whitespace-pre-wrap rounded bg-slate-50 p-2 font-mono text-xs">{d.prompt}</pre>
                  </details>
                </li>
              ))}
            </ol>
          )}
        </Step>

        {/* Typed from scratch is already said under the drafts and in the approval. */}
        {entry.edited && entry.source !== 'none' && (
          <Step title="Edited by hand">
            <p>The officer changed the model’s text before approving it. The checker re-checked every change.</p>
          </Step>
        )}

        <Step title="Approved and saved">
          <p>
            Written by {writerLabel(entry.source, entry.cloudModel)}. Approved by {approverLabel(entry.by, uid)}
            {entry.at ? ` at ${formatTime(entry.at)}` : ''}. The checker passed this exact text again before it was saved.
          </p>
          <blockquote className="mt-1 whitespace-pre-wrap border-l-4 border-emerald-300 pl-2">{entry.text}</blockquote>
          <p className="mt-1 text-slate-700">{statusText(status, entry.pending)}</p>
        </Step>
      </ol>
    </details>
  )
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li>
      <h4 className="font-semibold">{title}</h4>
      <div className="mt-1">{children}</div>
    </li>
  )
}

function statusText(status: EntryStatus, pending: boolean): string {
  const upload = pending ? 'Saved on this laptop: it uploads when the laptop is back online. ' : ''
  if (status === 'current') return `${upload}This is the alert saved now for this household and area.`
  if (status === 'replaced') return `${upload}A later approval replaced this alert. This record stays.`
  return upload
}

function StatusBadge({ status, pending }: { status: EntryStatus; pending: boolean }) {
  return (
    <>
      {status === 'current' && <span className="rounded bg-emerald-100 px-1.5 text-xs font-semibold text-emerald-900">Current alert</span>}
      {status === 'replaced' && <span className="rounded bg-slate-200 px-1.5 text-xs font-semibold text-slate-700">Replaced</span>}
      {pending && <span className="ml-1 rounded bg-amber-100 px-1.5 text-xs font-semibold text-amber-950">Not uploaded yet</span>}
    </>
  )
}
