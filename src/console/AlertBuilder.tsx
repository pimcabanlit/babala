import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { alertDocId, areaKey, type SavedAlert } from '../alerts/record'
import type { CheckResult, FactSheet } from '../checker'
import { HOUSEHOLDS, type Household, type HouseholdId } from '../drafting/households'
import { checkFor } from '../drafting/check'
import { TAB_STATUS_TEXT, tabStatus, type TabStatus } from './create'
import DraftPanel from './DraftPanel'
import type { DraftMap } from './useDrafts'
import Button from '../ui/Button'
import Icon, { type IconName } from '../ui/Icon'

type Props = {
  sheet: FactSheet
  area: string
  areas: string[]
  onArea: (area: string) => void
  drafts: DraftMap
  claimWords: string[]
  now: number
  budgetSeconds: number
  cloudModel: string
  online: boolean
  /** Why drafting is off, or undefined when it can start. */
  blockReason: string | undefined
  busy: boolean
  onDraft: (h: Household) => void
  onDraftAll: () => void
  onAbandon: (id: HouseholdId) => void
  onCancel: (id: HouseholdId) => void
  onEdit: (id: HouseholdId, text: string) => void
  /** Saved alerts by document ID, once loaded. */
  saved: ReadonlyMap<string, SavedAlert> | undefined
  saveErrors: Partial<Record<HouseholdId, string>>
  onApprove: (h: Household) => void
  onShowLedger: (ledgerId: string) => void
  onTranslate: (alertId: string) => void
}

const TAB_ICON: Record<TabStatus, { icon: IconName; className: string }> = {
  empty: { icon: 'radio_button_unchecked', className: 'text-on-surface-variant' },
  drafting: { icon: 'progress_activity', className: 'animate-spin text-primary' },
  fails: { icon: 'error', className: 'text-error' },
  passes: { icon: 'check', className: 'text-success' },
  approved: { icon: 'check_circle', className: 'text-success' },
}

/**
 * Step 3: the area, "Draft all four", and a tab for each household with its
 * state as an icon, so all four show at a glance while the officer works on
 * one. Each tab's panel stays mounted while hidden, so a draft keeps
 * streaming and an edit keeps its place. While "Draft all four" runs, the
 * tabs follow the alert being drafted, until the officer picks a tab, edits
 * or approves.
 */
export default function AlertBuilder(props: Props) {
  const { sheet, area, drafts, claimWords, saved } = props
  const [selected, setSelected] = useState<HouseholdId>('general')
  const [follow, setFollow] = useState(false)
  const tabs = useRef<Partial<Record<HouseholdId, HTMLButtonElement | null>>>({})
  const savedKey = areaKey(area)
  const savedFor = (id: HouseholdId) => (savedKey ? saved?.get(alertDocId(id, savedKey)) : undefined)

  const running = HOUSEHOLDS.find((h) => drafts[h.id].running)?.id
  // Follows "Draft all four" from one household to the next (React's "adjust state while rendering").
  if (follow && running && running !== selected) setSelected(running)

  // The checker on each household's text, for its tab and its panel: code only, so it runs as the officer types.
  // Not while a draft streams in, since nothing shows the result until it ends.
  const results = useMemo(
    () =>
      Object.fromEntries(
        HOUSEHOLDS.map((h) => {
          const d = drafts[h.id]
          return [h.id, d.running || !d.text.trim() ? undefined : checkFor(d.text, sheet, area, h, claimWords)]
        }),
      ) as Record<HouseholdId, CheckResult | undefined>,
    [drafts, sheet, area, claimWords],
  )
  const statusOf = (id: HouseholdId): TabStatus => {
    const d = drafts[id]
    // As on the panel: a withdrawn alert's approval no longer stands.
    return tabStatus({ running: d.running, approved: d.approved && !savedFor(id)?.withdrawn, passed: results[id]?.pass })
  }

  function pick(id: HouseholdId) {
    setFollow(false)
    setSelected(id)
  }

  /** Arrow keys, Home and End move between the tabs, as in the ARIA tabs pattern. */
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = HOUSEHOLDS.length - 1
    const to =
      e.key === 'ArrowRight' ? (index === last ? 0 : index + 1) : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? last : undefined
    if (to === undefined) return
    e.preventDefault()
    const id = HOUSEHOLDS[to].id
    pick(id)
    tabs.current[id]?.focus()
  }

  const reasonId = props.blockReason ? 'draft-block-reason' : undefined

  /**
   * Brings the alert text into view, if it isn't, as a draft starts: on a
   * short laptop screen the panel starts below the fold, and the officer
   * should see the words stream in. It moves only as far as it must.
   */
  function showText(id: HouseholdId) {
    requestAnimationFrame(() => document.getElementById(`text-${id}`)?.scrollIntoView({ block: 'nearest' }))
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="draft-area" className="text-title-sm">
          Area
        </label>
        <select
          id="draft-area"
          className="field w-auto min-w-48"
          value={area}
          onChange={(e) => props.onArea(e.target.value)}
          disabled={props.busy}
        >
          {props.areas.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <Button
          variant="tonal"
          onClick={() => {
            setFollow(true)
            setSelected(HOUSEHOLDS[0].id)
            showText(HOUSEHOLDS[0].id)
            props.onDraftAll()
          }}
          disabled={props.blockReason !== undefined}
          aria-describedby={reasonId}
        >
          Draft all four
        </Button>
      </div>
      {props.blockReason && (
        <p id={reasonId} className="mt-2 text-body-md text-on-surface-variant">
          {props.blockReason}
        </p>
      )}

      {/* Two rows of two on a phone, so every household and its state show without scrolling sideways. */}
      <div role="tablist" aria-label="Households" className="mt-4 grid grid-cols-2 border-b border-outline-variant sm:flex">
        {HOUSEHOLDS.map((h, i) => {
          const active = h.id === selected
          const status = statusOf(h.id)
          return (
            <button
              key={h.id}
              ref={(el) => {
                tabs.current[h.id] = el
              }}
              type="button"
              role="tab"
              id={`tab-${h.id}`}
              aria-selected={active}
              aria-controls={`panel-${h.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => pick(h.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
              title={TAB_STATUS_TEXT[status]}
              className={`relative flex h-12 min-w-0 items-center justify-center gap-2 px-2 text-title-sm whitespace-nowrap sm:flex-1 sm:px-4 hover:bg-on-surface/8 focus-visible:-outline-offset-2 ${
                active ? 'text-primary' : 'text-on-surface-variant'
              }`}
            >
              <Icon name={TAB_ICON[status].icon} className={`size-[18px] ${TAB_ICON[status].className}`} />
              {h.label}
              <span className="sr-only">, {TAB_STATUS_TEXT[status]}</span>
              {active && <span aria-hidden="true" className="absolute inset-x-4 bottom-0 h-[3px] rounded-t-full bg-primary" />}
            </button>
          )
        })}
      </div>

      {HOUSEHOLDS.map((h) => (
        <div key={h.id} role="tabpanel" id={`panel-${h.id}`} aria-labelledby={`tab-${h.id}`} hidden={h.id !== selected} className="pt-4">
          <DraftPanel
            household={h}
            draft={drafts[h.id]}
            result={results[h.id]}
            now={props.now}
            budgetSeconds={props.budgetSeconds}
            cloudModel={props.cloudModel}
            online={props.online}
            canDraft={props.blockReason === undefined}
            blockReasonId={reasonId}
            onDraft={() => {
              setFollow(false)
              showText(h.id)
              props.onDraft(h)
            }}
            onAbandon={() => props.onAbandon(h.id)}
            onCancel={() => props.onCancel(h.id)}
            onEdit={(text) => {
              setFollow(false)
              props.onEdit(h.id, text)
            }}
            saved={savedFor(h.id)}
            saveError={props.saveErrors[h.id]}
            onApprove={() => {
              setFollow(false)
              props.onApprove(h)
            }}
            onShowLedger={props.onShowLedger}
            onTranslate={props.onTranslate}
          />
        </div>
      ))}
    </div>
  )
}
