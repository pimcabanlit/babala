import { useEffect, useRef } from 'react'
import type { SavedAlert } from '../alerts/record'
import { to12h } from '../factsheet/form'
import { HOUSEHOLDS } from '../drafting/households'
import { LEDGER_PAGE, type LedgerView } from '../ledger/store'
import type { ApprovedLedgerEntry, LedgerDraft, LedgerEntry, TranslatedLedgerEntry, WithdrawnLedgerEntry } from '../ledger/record'
import { languageLabel } from '../translation/languages'
import type { PublishedTranslations } from '../translation/record'
import { formatTime } from './format'
import { approverLabel, draftLine, entryStatus, writerLabel, type EntryStatus } from './ledgerView'
import { LinkButton } from '../ui/Button'
import { StatusChip } from '../ui/Chip'
import Notice from '../ui/Notice'

type Props = {
  view: LedgerView | undefined
  error: string | undefined
  /** The saved alerts by ID, to tell which entries are current; undefined while loading. */
  saved: ReadonlyMap<string, SavedAlert> | undefined
  /** The translations published on each resident copy, to tell which translation entries are current. */
  published: ReadonlyMap<string, PublishedTranslations> | undefined
  uid: string
  /** The entry to show open, e.g. after "See its ledger entry" on a card. */
  openId: string | undefined
  onOpen: (id: string | undefined) => void
}

/** The latest approvals, withdrawals and translations, newest first. Each opens into its trace. */
export default function Ledger({ view, error, saved, published, uid, openId, onOpen }: Props) {
  return (
    <div className="space-y-3 text-body-md">
      <p className="text-on-surface-variant">
        Every approval, withdrawal and published translation is saved with its record: the facts, each model draft and the
        checker’s verdict, any hand edit, and who did it when. Records can’t be changed or deleted, so a new approval or a
        withdrawal changes an alert but not its history.
      </p>
      {error && <Notice tone="error">Couldn’t read the ledger: {error}</Notice>}
      {!view && !error && <p className="text-on-surface-variant">Loading the ledger…</p>}
      {view && view.entries.length === 0 && <p className="text-on-surface-variant">No approvals yet.</p>}
      {view && view.unreadable.length > 0 && (
        <Notice tone="warning">
          These ledger documents aren’t entries this app can read: {view.unreadable.join(', ')}.
        </Notice>
      )}
      {view && view.entries.length >= LEDGER_PAGE && <p className="text-on-surface-variant">Showing the latest {LEDGER_PAGE} entries.</p>}
      <ol className="space-y-2">
        {view?.entries.map((entry) => (
          <li key={entry.id}>
            <Entry
              entry={entry}
              status={entryStatus(entry, saved, published)}
              uid={uid}
              open={entry.id === openId}
              onToggle={(open) => onOpen(open ? entry.id : undefined)}
              onOpen={onOpen}
            />
          </li>
        ))}
      </ol>
    </div>
  )
}

const KIND_LABEL: Record<LedgerEntry['kind'], string> = {
  approved: 'Approved',
  withdrawn: 'Withdrawn',
  translated: 'Translated',
}

function Entry({
  entry,
  status,
  uid,
  open,
  onToggle,
  onOpen,
}: {
  entry: LedgerEntry
  status: EntryStatus
  uid: string
  open: boolean
  onToggle: (open: boolean) => void
  onOpen: (id: string) => void
}) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (open) ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [open])
  const household = HOUSEHOLDS.find((h) => h.id === entry.household)?.label ?? entry.household

  return (
    <details
      ref={ref}
      id={`ledger-${entry.id}`}
      open={open}
      onToggle={(e) => {
        // Only report a change the officer made, not the one React just rendered.
        if (e.currentTarget.open !== open) onToggle(e.currentTarget.open)
      }}
      className="rounded-md border border-outline-variant p-3"
    >
      <summary className="cursor-pointer leading-8">
        <span className="font-medium">
          {entry.at ? formatTime(entry.at) : 'Time pending'} · {KIND_LABEL[entry.kind]}
          {entry.kind === 'translated' && ` into ${languageLabel(entry.lang)}`} · {household} · {entry.area}
        </span>{' '}
        <StatusBadge kind={entry.kind} status={status} pending={entry.pending} />
      </summary>
      {entry.kind === 'approved' && <ApprovedTrace entry={entry} status={status} uid={uid} />}
      {entry.kind === 'withdrawn' && <WithdrawnTrace entry={entry} status={status} uid={uid} onOpen={onOpen} />}
      {entry.kind === 'translated' && <TranslatedTrace entry={entry} status={status} uid={uid} onOpen={onOpen} />}
    </details>
  )
}

function ApprovedTrace({ entry, status, uid }: { entry: ApprovedLedgerEntry; status: EntryStatus; uid: string }) {
  const sheet = entry.factSheet
  const centres = sheet.evacuationCentres.join(', ')
  return (
    <ol className="mt-3 space-y-4 border-l-2 border-outline-variant pl-4">
      <Step title="Bulletin and confirmed facts">
        <p>
          {sheet.stormName || 'Storm name not given'} · Signal No. {entry.signal} over {entry.area} · landfall at{' '}
          {to12h(sheet.landfallTime)}
          {sheet.landfallDate ? ` on ${sheet.landfallDate}` : ''} · evacuate to {centres}
          {sheet.hotline ? ` · hotline ${sheet.hotline}` : ''}
        </p>
        <details className="mt-1">
          <summary className="cursor-pointer text-primary underline">Show the bulletin</summary>
          <pre className="mt-1 whitespace-pre-wrap rounded-sm bg-surface-container-low p-2 font-mono text-body-sm">{sheet.bulletinText}</pre>
        </details>
      </Step>

      <Step title="Drafts and checks">
        {entry.draftsOmitted > 0 && (
          <p className="text-on-surface-variant">
            {entry.draftsOmitted} older draft{entry.draftsOmitted === 1 ? '' : 's'} left out to keep the record small.
          </p>
        )}
        {entry.drafts.length === 0 ? (
          <p className="text-on-surface-variant">
            {entry.source === 'none'
              ? 'No model drafted this alert: the officer typed it.'
              : 'No new model drafts since this card’s last approval. The earlier entry for this alert has them.'}
          </p>
        ) : (
          <DraftList drafts={entry.drafts} cloudModel={entry.cloudModel} area={entry.area} />
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
        <blockquote className="mt-1 whitespace-pre-wrap border-l-4 border-success pl-3">{entry.text}</blockquote>
        <p className="mt-1 text-on-surface-variant">{statusText('approved', status, entry.pending)}</p>
      </Step>
    </ol>
  )
}

function WithdrawnTrace({
  entry,
  status,
  uid,
  onOpen,
}: {
  entry: WithdrawnLedgerEntry
  status: EntryStatus
  uid: string
  onOpen: (id: string) => void
}) {
  return (
    <ol className="mt-3 space-y-4 border-l-2 border-outline-variant pl-4">
      <Step title="The alert that was withdrawn">
        <blockquote className="whitespace-pre-wrap border-l-4 border-outline-variant pl-3 text-on-surface-variant line-through">{entry.text}</blockquote>
        <p className="mt-1">
          {entry.approvalId ? (
            <LinkButton onClick={() => onOpen(entry.approvalId)}>See the approval it withdrew</LinkButton>
          ) : (
            'It was approved before the ledger, so its approval has no entry.'
          )}
        </p>
      </Step>
      <Step title="Withdrawn">
        <p>
          Withdrawn by {approverLabel(entry.by, uid)}
          {entry.at ? ` at ${formatTime(entry.at)}` : ''}. Reason, kept in the ledger only:
        </p>
        <blockquote className="mt-1 whitespace-pre-wrap border-l-4 border-warning pl-3">{entry.reason}</blockquote>
        <p className="mt-1 text-on-surface-variant">{statusText('withdrawn', status, entry.pending)}</p>
      </Step>
    </ol>
  )
}

function TranslatedTrace({
  entry,
  status,
  uid,
  onOpen,
}: {
  entry: TranslatedLedgerEntry
  status: EntryStatus
  uid: string
  onOpen: (id: string) => void
}) {
  const language = languageLabel(entry.lang)
  return (
    <ol className="mt-3 space-y-4 border-l-2 border-outline-variant pl-4">
      <Step title="The approved English alert">
        <blockquote className="whitespace-pre-wrap border-l-4 border-outline-variant pl-3">{entry.english}</blockquote>
        <p className="mt-1">
          <LinkButton onClick={() => onOpen(entry.approvalId)}>See the approval it translates</LinkButton>
        </p>
      </Step>

      <Step title="Translations and checks">
        {entry.draftsOmitted > 0 && (
          <p className="text-on-surface-variant">
            {entry.draftsOmitted} older translation{entry.draftsOmitted === 1 ? '' : 's'} left out to keep the record small.
          </p>
        )}
        {entry.drafts.length === 0 ? (
          <p className="text-on-surface-variant">No model translated this alert: the officer typed it.</p>
        ) : (
          <DraftList drafts={entry.drafts} cloudModel={entry.cloudModel} area={entry.area} />
        )}
      </Step>

      {entry.edited && entry.source !== 'none' && (
        <Step title="Edited by hand">
          <p>The officer changed the model’s translation before publishing it. The checker re-checked every change.</p>
        </Step>
      )}

      <Step title={`Published in ${language}`}>
        <p>
          Written by {writerLabel(entry.source, entry.cloudModel)}. Published by {approverLabel(entry.by, uid)}
          {entry.at ? ` at ${formatTime(entry.at)}` : ''}. The checker passed this exact text against the English alert again
          before it was published.
        </p>
        <blockquote lang={entry.lang} className="mt-1 whitespace-pre-wrap border-l-4 border-success pl-3">
          {entry.text}
        </blockquote>
        <p className="mt-1 text-on-surface-variant">{statusText('translated', status, entry.pending)}</p>
      </Step>
    </ol>
  )
}

/** Each model call behind an entry: how it went, its text, the checker's problems and the prompt. */
function DraftList({ drafts, cloudModel, area }: { drafts: LedgerDraft[]; cloudModel: string; area: string }) {
  return (
    <ol className="space-y-2">
      {drafts.map((d, i) => (
        <li key={i}>
          <p className="font-medium">
            {draftLine(d, cloudModel)}
            {d.area !== area && <span className="font-normal text-on-surface-variant"> · drafted for {d.area}</span>}
          </p>
          {d.text && <blockquote className="mt-1 whitespace-pre-wrap border-l-4 border-outline-variant pl-3">{d.text}</blockquote>}
          {d.issues.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-on-error-container">
              {d.issues.map((issue, j) => (
                <li key={j}>{issue.message}</li>
              ))}
            </ul>
          )}
          <details className="mt-1">
            <summary className="cursor-pointer text-body-sm text-primary underline">Show the prompt</summary>
            <pre className="mt-1 whitespace-pre-wrap rounded-sm bg-surface-container-low p-2 font-mono text-body-sm">{d.prompt}</pre>
          </details>
        </li>
      ))}
    </ol>
  )
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <li>
      <h4 className="text-title-sm">{title}</h4>
      <div className="mt-1">{children}</div>
    </li>
  )
}

function statusText(kind: LedgerEntry['kind'], status: EntryStatus, pending: boolean): string {
  const upload = pending ? 'Saved on this laptop: it uploads when the laptop is back online. ' : ''
  if (kind === 'translated') {
    if (status === 'current') return `${upload}Residents get this translation now.`
    if (status === 'withdrawn') return `${upload}An officer later withdrew the alert, so residents no longer get it. This record stays.`
    if (status === 'replaced') return `${upload}A later translation or a new approval of the alert replaced it. This record stays.`
    return upload
  }
  if (kind === 'withdrawn') {
    if (status === 'current') return `${upload}The alert is still withdrawn.`
    if (status === 'replaced') return `${upload}A later approval replaced the withdrawn alert. This record stays.`
    return upload
  }
  if (status === 'current') return `${upload}This is the alert saved now for this household and area.`
  if (status === 'withdrawn') return `${upload}An officer later withdrew this alert. This record stays.`
  if (status === 'replaced') return `${upload}A later approval replaced this alert. This record stays.`
  return upload
}

function StatusBadge({ kind, status, pending }: { kind: LedgerEntry['kind']; status: EntryStatus; pending: boolean }) {
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {status === 'current' &&
        (kind === 'withdrawn' ? (
          <StatusChip tone="warning" icon="block">
            Still withdrawn
          </StatusChip>
        ) : (
          <StatusChip tone="success" icon="check_circle">
            {kind === 'approved' ? 'Current alert' : 'Current translation'}
          </StatusChip>
        ))}
      {status === 'withdrawn' && (
        <StatusChip tone="warning" icon="block">
          Withdrawn
        </StatusChip>
      )}
      {status === 'replaced' && <StatusChip tone="neutral">Replaced</StatusChip>}
      {pending && (
        <StatusChip tone="warning" icon="cloud_upload">
          Not uploaded yet
        </StatusChip>
      )}
    </span>
  )
}
