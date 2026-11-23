import { useEffect, useRef, type ReactNode } from 'react'
import type { SavedAlert } from '../alerts/record'
import { to12h } from '../factsheet/form'
import { HOUSEHOLDS } from '../drafting/households'
import { LEDGER_PAGE, type LedgerView } from '../ledger/store'
import type { ApprovedLedgerEntry, LedgerDraft, LedgerEntry, TranslatedLedgerEntry, WithdrawnLedgerEntry } from '../ledger/record'
import { languageLabel } from '../translation/languages'
import type { PublishedTranslations } from '../translation/record'
import { formatTime } from './format'
import { approverLabel, draftLine, entryStatus, writerLabel, type EntryStatus } from './ledgerView'
import { hashFor } from './workspace'
import Button, { LinkButton } from '../ui/Button'
import { StatusChip } from '../ui/Chip'
import Icon, { type IconName } from '../ui/Icon'
import Notice from '../ui/Notice'

type Props = {
  view: LedgerView | undefined
  error: string | undefined
  /** The saved alerts by ID, to tell which entries are current; undefined while loading. */
  saved: ReadonlyMap<string, SavedAlert> | undefined
  /** The translations published on each resident copy, to tell which translation entries are current. */
  published: ReadonlyMap<string, PublishedTranslations> | undefined
  uid: string
  /** The entry in the address (`#ledger/<id>`), e.g. after "See its ledger entry" on a card. */
  openId: string | undefined
  /** Opens an entry, or the list again with undefined. */
  onOpen: (id: string | undefined) => void
  /** Opens *Create an alert*, from the empty state. */
  onCreate: () => void
}

/** The detail panel's ID, which links from other views move focus to. */
export const LEDGER_DETAIL_ID = 'ledger-detail'

/** Matches Tailwind's `lg`, where the list and the trace sit side by side. */
const WIDE = '(min-width: 64rem)'

const rowId = (id: string) => `ledger-row-${id}`

/**
 * The latest approvals, withdrawals and translations, newest first, beside
 * the trace of the one open. On a laptop the newest is open until the officer
 * picks another; on a phone the list and the trace take turns, like pages.
 */
export default function Ledger({ view, error, saved, published, uid, openId, onOpen, onCreate }: Props) {
  const entries = view?.entries
  const shown = openId ? entries?.find((e) => e.id === openId) : entries?.[0]
  const list = useRef<HTMLOListElement>(null)
  const lastOpen = useRef(openId)
  const found = Boolean(openId && shown)

  /** A link inside a trace replaces the trace it sits in, so focus goes to the new one. */
  function openFromTrace(id: string) {
    onOpen(id)
    requestAnimationFrame(() => document.getElementById(LEDGER_DETAIL_ID)?.focus({ preventScroll: true }))
  }

  // Opening an entry from a link, the address or the back button: bring it into view.
  useEffect(() => {
    const before = lastOpen.current
    lastOpen.current = openId
    if (!openId && before) {
      // Back to the list on a phone: to the row the officer came from.
      const row = document.getElementById(rowId(before))
      if (row?.offsetParent && !window.matchMedia(WIDE).matches) {
        row.scrollIntoView({ block: 'center' })
        row.focus({ preventScroll: true })
      }
      return
    }
    if (!openId || !found) return
    const detail = document.getElementById(LEDGER_DETAIL_ID)
    if (!detail?.offsetParent) return
    if (!window.matchMedia(WIDE).matches) {
      // The list just hid, taking the focused row with it: start at "All entries", past the intro.
      detail.parentElement?.scrollIntoView({ block: 'start' })
      detail.focus({ preventScroll: true })
      return
    }
    const row = document.getElementById(rowId(openId))
    const box = list.current
    if (row && box && (row.offsetTop < box.scrollTop || row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight)) {
      box.scrollTop = row.offsetTop - box.clientHeight / 3
    }
    if (detail.getBoundingClientRect().top < 0) detail.scrollIntoView({ block: 'start' })
  }, [openId, found])

  return (
    <div className="space-y-4 text-body-md">
      {error && <Notice tone="error">Couldn’t read the ledger: {error}</Notice>}
      {view && view.unreadable.length > 0 && (
        <Notice tone="warning">These ledger documents aren’t entries this app can read: {view.unreadable.join(', ')}.</Notice>
      )}
      {!view && !error && <Loading />}
      {entries?.length === 0 && <Empty onCreate={onCreate} />}
      {entries && entries.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
          {/* Its own scroll on a laptop, so a long trace doesn't push the list out of reach. */}
          <div className={`lg:sticky lg:top-4 ${openId ? 'max-lg:hidden' : ''}`}>
            <ol
              ref={list}
              aria-label="Ledger entries, newest first"
              className="relative -m-1 space-y-2 p-1 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto"
            >
              {entries.map((entry) => (
                <li key={entry.id}>
                  <Row
                    entry={entry}
                    status={entryStatus(entry, saved, published)}
                    // With none in the address, the newest shows beside the list on a laptop; a phone shows the list alone.
                    current={entry.id === openId ? 'open' : !openId && entry.id === shown?.id ? 'beside' : undefined}
                  />
                </li>
              ))}
              {entries.length >= LEDGER_PAGE && (
                <li className="px-1 pt-1 text-body-sm text-on-surface-variant">Showing the latest {LEDGER_PAGE} entries.</li>
              )}
            </ol>
          </div>
          <div className={`scroll-mt-2 ${openId ? '' : 'max-lg:hidden'}`}>
            {openId && (
              <Button variant="text" onClick={() => onOpen(undefined)} className="-ml-3 mb-2 lg:hidden">
                <Icon name="arrow_back" className="size-5" />
                All entries
              </Button>
            )}
            {shown ? (
              <Detail key={shown.id} entry={shown} status={entryStatus(shown, saved, published)} uid={uid} onOpen={openFromTrace} />
            ) : (
              <Notice tone="warning">That entry isn’t among the latest {LEDGER_PAGE} shown here.</Notice>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const KIND: Record<LedgerEntry['kind'], { label: string; icon: IconName; circle: string }> = {
  approved: { label: 'Approved', icon: 'check_circle', circle: 'bg-success-container text-on-success-container' },
  withdrawn: { label: 'Withdrawn', icon: 'block', circle: 'bg-warning-container text-on-warning-container' },
  translated: { label: 'Translated', icon: 'translate', circle: 'bg-surface-container-highest text-primary' },
}

const kindText = (entry: LedgerEntry) =>
  entry.kind === 'translated' ? `${KIND.translated.label} into ${languageLabel(entry.lang)}` : KIND[entry.kind].label

const householdLabel = (entry: LedgerEntry) => HOUSEHOLDS.find((h) => h.id === entry.household)?.label ?? entry.household

const entryTime = (entry: LedgerEntry) => (entry.at ? formatTime(entry.at) : 'Time pending')

function KindIcon({ kind, size = 'size-10' }: { kind: LedgerEntry['kind']; size?: string }) {
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full ${size} ${KIND[kind].circle}`}>
      <Icon name={KIND[kind].icon} className="size-5" />
    </span>
  )
}

const ROW = {
  open: 'border-transparent bg-primary-container text-on-primary-container',
  beside:
    'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low lg:border-transparent lg:bg-primary-container lg:text-on-primary-container lg:hover:bg-primary-container',
  none: 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low',
}

function Row({ entry, status, current }: { entry: LedgerEntry; status: EntryStatus; current: 'open' | 'beside' | undefined }) {
  const chips = status !== 'unknown' || entry.pending
  return (
    <a
      id={rowId(entry.id)}
      href={hashFor('ledger', entry.id)}
      aria-current={current === 'open' ? 'true' : undefined}
      className={`flex gap-3 rounded-md border p-3 transition-colors ${ROW[current ?? 'none']}`}
    >
      <KindIcon kind={entry.kind} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 text-title-sm">{kindText(entry)}</span>
          <span className="shrink-0 text-body-sm opacity-80">{entryTime(entry)}</span>
        </span>
        <span className="block truncate text-body-sm opacity-80">
          {householdLabel(entry)} · {entry.area}
        </span>
        {chips && (
          <span className="mt-1.5 flex flex-wrap gap-1">
            <StatusChips kind={entry.kind} status={status} pending={entry.pending} />
          </span>
        )}
      </span>
    </a>
  )
}

function Detail({ entry, status, uid, onOpen }: { entry: LedgerEntry; status: EntryStatus; uid: string; onOpen: (id: string) => void }) {
  return (
    <section
      id={LEDGER_DETAIL_ID}
      tabIndex={-1}
      aria-labelledby={`${LEDGER_DETAIL_ID}-title`}
      className="scroll-mt-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 outline-none sm:p-5"
    >
      <header className="flex items-start gap-3">
        <KindIcon kind={entry.kind} size="size-12" />
        <div className="min-w-0 flex-1">
          <h2 id={`${LEDGER_DETAIL_ID}-title`} className="text-title-lg">
            {kindText(entry)} · {householdLabel(entry)} · {entry.area}
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-md text-on-surface-variant">
            {entryTime(entry)}
            <StatusChips kind={entry.kind} status={status} pending={entry.pending} />
          </p>
        </div>
      </header>
      {entry.kind === 'approved' && <ApprovedTrace entry={entry} status={status} uid={uid} />}
      {entry.kind === 'withdrawn' && <WithdrawnTrace entry={entry} status={status} uid={uid} onOpen={onOpen} />}
      {entry.kind === 'translated' && <TranslatedTrace entry={entry} status={status} uid={uid} onOpen={onOpen} />}
    </section>
  )
}

function ApprovedTrace({ entry, status, uid }: { entry: ApprovedLedgerEntry; status: EntryStatus; uid: string }) {
  const sheet = entry.factSheet
  const centres = sheet.evacuationCentres.join(', ')
  return (
    <Timeline>
      <Step icon="fact_check" title="Bulletin and confirmed facts">
        <p>
          {sheet.stormName || 'Storm name not given'} · Signal No. {entry.signal} over {entry.area} · landfall at{' '}
          {to12h(sheet.landfallTime)}
          {sheet.landfallDate ? ` on ${sheet.landfallDate}` : ''} · evacuate to {centres}
          {sheet.hotline ? ` · hotline ${sheet.hotline}` : ''}
        </p>
        <Fold summary="Show the bulletin">
          <pre className="whitespace-pre-wrap rounded-sm bg-surface-container-low p-2 font-mono text-body-sm">{sheet.bulletinText}</pre>
        </Fold>
      </Step>

      <Step icon="history" title="Drafts and checks">
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
        <Step icon="edit" title="Edited by hand">
          <p>The officer changed the model’s text before approving it. The checker re-checked every change.</p>
        </Step>
      )}

      <Step icon="check_circle" tone="success" title="Approved and saved">
        <p>
          Written by {writerLabel(entry.source, entry.cloudModel)}. Approved by {approverLabel(entry.by, uid)}
          {entry.at ? ` at ${formatTime(entry.at)}` : ''}. The checker passed this exact text again before it was saved.
        </p>
        <Quote tone="success">{entry.text}</Quote>
        <p className="mt-2 text-on-surface-variant">{statusText('approved', status, entry.pending)}</p>
      </Step>
    </Timeline>
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
    <Timeline>
      <Step icon="campaign" title="The alert that was withdrawn">
        <Quote tone="struck">{entry.text}</Quote>
        <p className="mt-2">
          {entry.approvalId ? (
            <LinkButton onClick={() => onOpen(entry.approvalId)}>See the approval it withdrew</LinkButton>
          ) : (
            'It was approved before the ledger, so its approval has no entry.'
          )}
        </p>
      </Step>
      <Step icon="block" tone="warning" title="Withdrawn">
        <p>
          Withdrawn by {approverLabel(entry.by, uid)}
          {entry.at ? ` at ${formatTime(entry.at)}` : ''}. Reason, kept in the ledger only:
        </p>
        <Quote tone="warning">{entry.reason}</Quote>
        <p className="mt-2 text-on-surface-variant">{statusText('withdrawn', status, entry.pending)}</p>
      </Step>
    </Timeline>
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
    <Timeline>
      <Step icon="campaign" title="The approved English alert">
        <Quote>{entry.english}</Quote>
        <p className="mt-2">
          <LinkButton onClick={() => onOpen(entry.approvalId)}>See the approval it translates</LinkButton>
        </p>
      </Step>

      <Step icon="translate" title="Translations and checks">
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
        <Step icon="edit" title="Edited by hand">
          <p>The officer changed the model’s translation before publishing it. The checker re-checked every change.</p>
        </Step>
      )}

      <Step icon="check_circle" tone="success" title={`Published in ${language}`}>
        <p>
          Written by {writerLabel(entry.source, entry.cloudModel)}. Published by {approverLabel(entry.by, uid)}
          {entry.at ? ` at ${formatTime(entry.at)}` : ''}. The checker passed this exact text against the English alert again
          before it was published.
        </p>
        <Quote tone="success" lang={entry.lang}>
          {entry.text}
        </Quote>
        <p className="mt-2 text-on-surface-variant">{statusText('translated', status, entry.pending)}</p>
      </Step>
    </Timeline>
  )
}

const OUTCOME_ICON: Record<LedgerDraft['outcome'], { icon: IconName; color: string }> = {
  passed: { icon: 'check_circle', color: 'text-success' },
  failed: { icon: 'error', color: 'text-error' },
  error: { icon: 'error', color: 'text-error' },
  stopped: { icon: 'warning', color: 'text-warning' },
  cancelled: { icon: 'block', color: 'text-on-surface-variant' },
}

/** Each model call behind an entry: how it went, its text, the checker's problems and the prompt. */
function DraftList({ drafts, cloudModel, area }: { drafts: LedgerDraft[]; cloudModel: string; area: string }) {
  return (
    <ol className="mt-2 space-y-2">
      {drafts.map((d, i) => (
        <li key={i} className="rounded-md bg-surface-container-low p-3">
          <p className="flex gap-2 font-medium">
            <Icon name={OUTCOME_ICON[d.outcome].icon} className={`mt-0.5 size-4 shrink-0 ${OUTCOME_ICON[d.outcome].color}`} />
            <span>
              {draftLine(d, cloudModel)}
              {d.area !== area && <span className="font-normal text-on-surface-variant"> · drafted for {d.area}</span>}
            </span>
          </p>
          {d.text && <Quote>{d.text}</Quote>}
          {d.issues.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-on-error-container">
              {d.issues.map((issue, j) => (
                <li key={j}>{issue.message}</li>
              ))}
            </ul>
          )}
          <Fold summary="Show the prompt">
            <pre className="whitespace-pre-wrap rounded-sm bg-surface-container p-2 font-mono text-body-sm">{d.prompt}</pre>
          </Fold>
        </li>
      ))}
    </ol>
  )
}

/** The steps of a trace, joined by a line from each icon to the next. */
function Timeline({ children }: { children: ReactNode }) {
  return <ol className="mt-5">{children}</ol>
}

const STEP_TONE = {
  neutral: 'bg-surface-container-high text-on-surface-variant',
  success: 'bg-success-container text-on-success-container',
  warning: 'bg-warning-container text-on-warning-container',
}

function Step({
  icon,
  tone = 'neutral',
  title,
  children,
}: {
  icon: IconName
  tone?: keyof typeof STEP_TONE
  title: string
  children: ReactNode
}) {
  return (
    <li className="group relative flex gap-3 pb-6 last:pb-0">
      <span aria-hidden="true" className="absolute top-10 bottom-0 left-[1.1875rem] w-0.5 bg-outline-variant group-last:hidden" />
      <span aria-hidden="true" className={`flex size-10 shrink-0 items-center justify-center rounded-full ${STEP_TONE[tone]}`}>
        <Icon name={icon} className="size-5" />
      </span>
      <div className="min-w-0 flex-1 pt-2">
        <h3 className="text-title-sm">{title}</h3>
        <div className="mt-1">{children}</div>
      </div>
    </li>
  )
}

const QUOTE_TONE = {
  neutral: 'border-outline-variant',
  success: 'border-success',
  warning: 'border-warning',
  struck: 'border-outline-variant text-on-surface-variant line-through',
}

function Quote({ tone = 'neutral', lang, children }: { tone?: keyof typeof QUOTE_TONE; lang?: string; children: ReactNode }) {
  return (
    <blockquote lang={lang} className={`mt-2 border-l-4 pl-3 whitespace-pre-wrap ${QUOTE_TONE[tone]}`}>
      {children}
    </blockquote>
  )
}

function Fold({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group/fold mt-2">
      <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 rounded-sm text-body-sm font-medium text-primary hover:underline [&::-webkit-details-marker]:hidden">
        <Icon name="expand_more" className="size-4 transition-transform group-open/fold:rotate-180" />
        {summary}
      </summary>
      <div className="mt-1">{children}</div>
    </details>
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

function StatusChips({ kind, status, pending }: { kind: LedgerEntry['kind']; status: EntryStatus; pending: boolean }) {
  return (
    <>
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
    </>
  )
}

/** Grey blocks in the shape of the list and the trace, while the ledger loads. */
function Loading() {
  return (
    <div role="status" className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <span className="sr-only">Loading the ledger…</span>
      <div className="space-y-2">
        <div className="h-20 animate-pulse rounded-md bg-surface-container-high" />
        <div className="h-20 animate-pulse rounded-md bg-surface-container-high" />
        <div className="h-20 animate-pulse rounded-md bg-surface-container-high" />
      </div>
      <div className="hidden h-72 animate-pulse rounded-lg bg-surface-container-high lg:block" />
    </div>
  )
}

function Empty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-outline-variant px-6 py-10 text-center">
      <Icon name="receipt_long" className="mx-auto size-10 text-on-surface-variant" />
      <p className="mt-3 text-title-md">No approvals yet.</p>
      <Button variant="filled" onClick={onCreate} className="mt-5">
        Create an alert
      </Button>
    </div>
  )
}
