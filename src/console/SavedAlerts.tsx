import { useEffect, useMemo, useRef, useState } from 'react'
import type { SavedAlert } from '../alerts/record'
import { HOUSEHOLDS } from '../drafting/households'
import { LEDGER_LIMITS } from '../ledger/record'
import { formatTime } from './format'
import { approverLabel } from './ledgerView'
import { ALL_SAVED, filterCounts, groupByArea, selectedAlert, type SavedFilter, type SavedStatus } from './savedView'
import Translations, { type TranslationActions } from './Translations'
import type { TranslationClaims } from '../firebase/remoteConfig'
import { LANGUAGES } from '../translation/languages'
import type { PublishedTranslations } from '../translation/record'
import Button, { LinkButton } from '../ui/Button'
import { FilterChip, StatusChip } from '../ui/Chip'
import Dialog from '../ui/Dialog'
import Icon from '../ui/Icon'
import Notice from '../ui/Notice'

/** What the officer picked: the filter chips and the alert open in the detail panel. */
export type SavedPick = { filter: SavedFilter; selected: string | undefined }

type Props = {
  saved: SavedAlert[] | undefined
  /** IDs of documents that aren't alerts this app can read, e.g. after a hand edit in the console. */
  unreadable: string[]
  error: string | undefined
  uid: string
  /** Errors from withdrawals that the server refused, by alert ID. */
  withdrawErrors: Partial<Record<string, string>>
  /** Starts a withdrawal; returns why it can't start, or undefined once it is saved on the laptop. */
  onWithdraw: (alert: SavedAlert, reason: string) => string | undefined
  onShowLedger: (ledgerId: string) => void
  /** Opens *Create an alert*, from the empty state. */
  onCreate: () => void
  pick: SavedPick
  onPick: (pick: SavedPick) => void
  translations: TranslationProps
}

/** What each active alert's translations need. */
export type TranslationProps = {
  /** Translations published on each resident copy, by alert ID; undefined while loading. */
  published: ReadonlyMap<string, PublishedTranslations> | undefined
  /** Why the published translations couldn't be read. */
  error: string | undefined
  actions: TranslationActions
  canTranslate: boolean
  claimWords: string[]
  translationClaims: TranslationClaims | undefined
}

/** The detail panel's ID, which "Next: translate" in *Create an alert* moves focus to. */
export const SAVED_DETAIL_ID = 'saved-detail'

const householdLabel = (alert: SavedAlert) => HOUSEHOLDS.find((h) => h.id === alert.household)?.label ?? alert.household

/**
 * Every saved alert, in every area: a list to pick one from, filtered by
 * status and area, and beside it (below it on a narrow screen) what residents
 * get, its translations, and the place to withdraw it. It needs no bulletin,
 * so an officer can act on an alert straight after opening the console.
 */
export default function SavedAlerts(props: Props) {
  const { saved, unreadable, error, pick, onPick, translations } = props
  const groups = useMemo(() => (saved ? groupByArea(saved, pick.filter) : []), [saved, pick.filter])
  const selected = selectedAlert(groups, pick.selected)

  function choose(id: string) {
    onPick({ ...pick, selected: id })
    // Under 1024 px the detail sits below the list, out of sight: take the officer to it.
    if (window.matchMedia('(min-width: 64rem)').matches) return
    requestAnimationFrame(() => {
      const detail = document.getElementById(SAVED_DETAIL_ID)
      detail?.scrollIntoView({ block: 'start' })
      detail?.focus({ preventScroll: true })
    })
  }

  return (
    <div className="space-y-4 text-body-md">
      {translations.error && <Notice tone="error">Couldn’t read the published translations: {translations.error}</Notice>}
      {error && <Notice tone="error">Couldn’t read the saved alerts: {error}</Notice>}
      {unreadable.length > 0 && (
        <Notice tone="warning">These saved documents aren’t alerts this app can read: {unreadable.join(', ')}.</Notice>
      )}
      {!saved && !error && <Loading />}
      {saved?.length === 0 && <Empty onCreate={props.onCreate} />}
      {saved && saved.length > 0 && (
        <>
          <Filters saved={saved} filter={pick.filter} onFilter={(filter) => onPick({ ...pick, filter })} />
          {groups.length === 0 ? (
            <p className="text-on-surface-variant">
              No saved alerts match these filters.{' '}
              <LinkButton onClick={() => onPick({ ...pick, filter: ALL_SAVED })}>Show all</LinkButton>
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start xl:grid-cols-[20rem_minmax(0,1fr)]">
              <List groups={groups} selected={selected} published={translations.published} onChoose={choose} />
              {selected && <Detail key={selected.id} {...props} alert={selected} />}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const STATUS_LABEL: Record<SavedStatus, string> = { all: 'All', active: 'Active', withdrawn: 'Withdrawn' }

function Filters({ saved, filter, onFilter }: { saved: SavedAlert[]; filter: SavedFilter; onFilter: (filter: SavedFilter) => void }) {
  const counts = filterCounts(saved, filter)
  return (
    <div role="group" aria-label="Filter saved alerts" className="flex flex-wrap items-center gap-2">
      {(['all', 'active', 'withdrawn'] as const).map((status) => (
        <FilterChip key={status} selected={filter.status === status} count={counts.status[status]} onClick={() => onFilter({ ...filter, status })}>
          {STATUS_LABEL[status]}
        </FilterChip>
      ))}
      {counts.areas.length > 1 && (
        <>
          <span aria-hidden="true" className="mx-1 h-6 w-px bg-outline-variant max-sm:hidden" />
          {counts.areas.map(({ area, count }) => (
            <FilterChip
              key={area}
              selected={filter.area === area}
              count={count}
              // A second click on the picked area shows every area again.
              onClick={() => onFilter({ ...filter, area: filter.area === area ? undefined : area })}
            >
              {area}
            </FilterChip>
          ))}
        </>
      )}
    </div>
  )
}

/**
 * The open alert's chips. An active one needs none: its row says so, and
 * "Withdraw" beside the title shows it. Grey for withdrawn, and amber for the
 * one state that needs the officer, an alert that isn't uploaded yet.
 */
function StatusChips({ alert }: { alert: SavedAlert }) {
  return (
    <>
      {alert.withdrawn && (
        <StatusChip tone="neutral" icon="block">
          Withdrawn
        </StatusChip>
      )}
      {alert.pending && (
        <StatusChip tone="warning" icon="cloud_upload">
          Not uploaded yet
        </StatusChip>
      )}
    </>
  )
}

const approvedText = (alert: SavedAlert) => (alert.approvedAt ? `Approved ${formatTime(alert.approvedAt)}` : 'Approval time pending')

function List({
  groups,
  selected,
  published,
  onChoose,
}: {
  groups: { area: string; alerts: SavedAlert[] }[]
  selected: SavedAlert | undefined
  published: ReadonlyMap<string, PublishedTranslations> | undefined
  onChoose: (id: string) => void
}) {
  return (
    <nav aria-label="Saved alerts by area" className="space-y-4">
      {groups.map((group) => (
        <section key={group.area} aria-label={group.area}>
          <h2 className="px-1 text-title-sm text-on-surface-variant">{group.area}</h2>
          <ul className="mt-2 space-y-2">
            {group.alerts.map((alert) => {
              const current = alert.id === selected?.id
              const languages = published?.get(alert.id)
              return (
                <li key={alert.id}>
                  <button
                    type="button"
                    id={`saved-${alert.id}`}
                    aria-pressed={current}
                    aria-controls={SAVED_DETAIL_ID}
                    onClick={() => onChoose(alert.id)}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${
                      current
                        ? 'border-transparent bg-primary-container text-on-primary-container'
                        : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-title-sm">{householdLabel(alert)}</span>
                      {/* Green for an active alert, grey for a withdrawn one: few colours, so the open alert's text stands out. */}
                      <StatusChip tone={alert.withdrawn ? 'neutral' : 'success'} icon={alert.withdrawn ? 'block' : 'check_circle'}>
                        {alert.withdrawn ? 'Withdrawn' : 'Active'}
                      </StatusChip>
                    </span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-body-sm opacity-80">
                      {approvedText(alert)}
                      {alert.pending && (
                        <StatusChip tone="warning" icon="cloud_upload">
                          Not uploaded yet
                        </StatusChip>
                      )}
                    </span>
                    {/* A withdrawn alert's translations go with it, so only an active one shows them. */}
                    {!alert.withdrawn && (
                      <span className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-body-sm">
                        {LANGUAGES.map((language) => {
                          const done = Boolean(languages?.[language.code])
                          return (
                            <span key={language.code} className="inline-flex items-center gap-1">
                              <Icon
                                name={done ? 'check_circle' : 'radio_button_unchecked'}
                                className={done ? 'size-4' : 'size-4 opacity-60'}
                              />
                              {language.label}
                              <span className="sr-only">{done ? ': published' : ': not published'}</span>
                            </span>
                          )
                        })}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </nav>
  )
}

function Detail({
  alert,
  uid,
  withdrawErrors,
  onWithdraw,
  onShowLedger,
  translations,
}: Props & { alert: SavedAlert }) {
  const [withdrawing, setWithdrawing] = useState(false)
  const { withdrawn } = alert
  // A withdrawn alert's latest entry is its withdrawal; otherwise its approval, if it has one.
  const entryId = withdrawn?.ledgerId ?? alert.ledgerId
  const error = withdrawErrors[alert.id]
  const title = `${householdLabel(alert)} · ${alert.area}`

  return (
    <section
      id={SAVED_DETAIL_ID}
      tabIndex={-1}
      aria-labelledby={`${SAVED_DETAIL_ID}-title`}
      className="@container scroll-mt-4 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 outline-none sm:p-5"
    >
      <header className="flex flex-wrap items-center gap-2">
        <h2 id={`${SAVED_DETAIL_ID}-title`} className="text-title-lg">
          {title}
        </h2>
        <StatusChips alert={alert} />
        {/* Not red here: red waits for the dialog, where the officer confirms it. */}
        {!withdrawn && (
          <Button size="sm" variant="outlined" onClick={() => setWithdrawing(true)} className="ml-auto">
            Withdraw
          </Button>
        )}
      </header>
      <p className="mt-1 text-body-md text-on-surface-variant">
        {approvedText(alert)}
        {withdrawn && ` · withdrawn by ${approverLabel(withdrawn.by, uid)}${withdrawn.at ? ` ${formatTime(withdrawn.at)}` : ''}`}
        {' · '}
        {entryId ? <LinkButton onClick={() => onShowLedger(entryId)}>See its ledger entry</LinkButton> : 'saved before the ledger'}
      </p>
      <p
        className={`mt-3 rounded-md border-l-4 p-3 text-body-lg whitespace-pre-wrap ${
          withdrawn ? 'border-outline-variant bg-surface-container text-on-surface-variant line-through' : 'border-error bg-surface-container-low'
        }`}
      >
        {alert.text}
      </p>
      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}
      {!withdrawn && (
        <Translations
          alert={alert}
          published={translations.published?.get(alert.id)}
          actions={translations.actions}
          canTranslate={translations.canTranslate}
          claimWords={translations.claimWords}
          translationClaims={translations.translationClaims}
          onShowLedger={onShowLedger}
        />
      )}
      {!withdrawn && (
        <WithdrawDialog
          open={withdrawing}
          title={title}
          onClose={() => setWithdrawing(false)}
          onWithdraw={(reason) => onWithdraw(alert, reason)}
        />
      )}
    </section>
  )
}

/** Asks for the reason, which goes in the ledger only, then withdraws. */
function WithdrawDialog({
  open,
  title,
  onClose,
  onWithdraw,
}: {
  open: boolean
  title: string
  onClose: () => void
  onWithdraw: (reason: string) => string | undefined
}) {
  const [reason, setReason] = useState('')
  const [problem, setProblem] = useState<string>()
  const field = useRef<HTMLTextAreaElement>(null)

  // Into the reason box, not the close button: the sheet opens to be filled in.
  // A frame later, since the sheet's showModal() runs after this effect and moves focus itself.
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => field.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [open])

  function close() {
    setReason('')
    setProblem(undefined)
    onClose()
  }

  function confirm() {
    const why = onWithdraw(reason)
    if (why) {
      setProblem(why)
      field.current?.focus()
    } else close()
  }

  return (
    <Dialog open={open} onClose={close} title="Withdraw this alert?" side="bottom">
      <p className="text-body-md">
        <span className="font-medium">{title}.</span> Withdrawing it keeps its text and its record, marks it withdrawn so residents no
        longer get it or its translations, and adds the reason to the ledger.
      </p>
      <label className="mt-4 block text-body-md font-medium" htmlFor="withdraw-reason">
        Why are you withdrawing it? The reason goes in the ledger only; residents don’t see it.
      </label>
      <textarea
        ref={field}
        id="withdraw-reason"
        value={reason}
        maxLength={LEDGER_LIMITS.reason}
        onChange={(e) => setReason(e.target.value)}
        rows={3}
        aria-describedby="withdraw-count"
        className="field mt-2"
      />
      <p id="withdraw-count" className="mt-1 text-right text-body-sm text-on-surface-variant tabular-nums">
        {reason.length} / {LEDGER_LIMITS.reason}
      </p>
      {problem && (
        <p role="alert" className="mt-2 font-medium text-error">
          {problem}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="text" onClick={close}>
          Cancel
        </Button>
        <Button variant="danger" onClick={confirm}>
          Withdraw this alert
        </Button>
      </div>
    </Dialog>
  )
}

/** Grey blocks in the shape of the list and the detail, while the saved alerts load. */
function Loading() {
  return (
    <div role="status" className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]">
      <span className="sr-only">Loading the saved alerts…</span>
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded-sm bg-surface-container-high" />
        <div className="h-24 animate-pulse rounded-md bg-surface-container-high" />
        <div className="h-24 animate-pulse rounded-md bg-surface-container-high" />
      </div>
      <div className="hidden h-64 animate-pulse rounded-lg bg-surface-container-high lg:block" />
    </div>
  )
}

function Empty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-outline-variant px-6 py-10 text-center">
      <Icon name="campaign" className="mx-auto size-10 text-on-surface-variant" />
      <p className="mt-3 text-title-md">No alerts saved yet.</p>
      <p className="mt-1 text-on-surface-variant">An alert shows here once you approve it, ready to translate or withdraw.</p>
      <Button variant="filled" onClick={onCreate} className="mt-5">
        Create an alert
      </Button>
    </div>
  )
}
