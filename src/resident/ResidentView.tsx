import { useEffect, useId, useState, type FormEvent } from 'react'
import Ask from './Ask'
import { hotlineNumbers } from './hotline'
import { formatShortTime, formatTime } from '../console/format'
import { HOUSEHOLDS, type HouseholdId } from '../drafting/households'
import { getFirebase } from '../firebase'
import type { OfflineApp } from '../offline/register'
import { useOfflineApp } from '../offline/useOfflineApp'
import {
  LANGUAGES,
  alertFor,
  languagesOf,
  packAreas,
  textIn,
  type ActivePackAlert,
  type Language,
  type PackAlert,
} from './pack'
import { useAskSetup } from './useAsk'
import { useChoice, useResidentPack } from './useResidentPack'
import { installMode, syncLine, syncPill, type SyncPill } from './view'
import AppBar from '../ui/AppBar'
import Button from '../ui/Button'
import Dialog from '../ui/Dialog'
import Icon from '../ui/Icon'
import { TITLE, WIDTH } from '../ui/layout'
import Notice from '../ui/Notice'
import Segmented from '../ui/Segmented'

const TONES = {
  ok: 'success',
  offline: 'neutral',
  problem: 'error',
} as const

/** The page's width while there is no active alert to spread across two columns: one column, even on a laptop. */
const PHONE_WIDTH = 'max-w-[40rem]'

const at = (ms: number) => formatTime(new Date(ms))

type Area = { areaKey: string; area: string }

function householdLabel(id: HouseholdId): string {
  return HOUSEHOLDS.find((h) => h.id === id)?.label ?? id
}

/**
 * The resident's page, for any phone browser: pick your purok and household
 * once, and read your alert. It opens from the pack saved on the phone first,
 * so it works with no signal.
 */
export default function ResidentView() {
  const { pack, sync } = useResidentPack(getFirebase())
  const askSetup = useAskSetup(getFirebase())
  const [choice, choose] = useChoice()
  const [changing, setChanging] = useState(false)
  // "Today" for the pill's short time; a page left open past midnight still shows the full date under the header card.
  const [openedAt] = useState(() => new Date())
  const areas = packAreas(pack)
  const areaKey = areas.some((a) => a.areaKey === choice.areaKey) ? choice.areaKey : undefined
  const area = areas.find((a) => a.areaKey === areaKey)?.area ?? ''
  const household = choice.household ?? 'general'
  const alert = areaKey ? alertFor(pack, household, areaKey) : undefined
  const line = syncLine(sync, at)
  const loading = pack === undefined && sync.online && !sync.error
  const active =
    alert?.status === 'active'
      ? { alert, languages: languagesOf(alert), shown: textIn(alert, choice.language ?? 'en') }
      : undefined

  return (
    <>
      <AppBar title={TITLE.resident}>
        <StatusPill pill={syncPill(sync, (ms) => formatShortTime(new Date(ms), openedAt))} />
      </AppBar>
      <main className={`mx-auto w-full flex-1 px-4 py-5 lg:py-8 ${active ? WIDTH.resident : PHONE_WIDTH}`}>
        <h1 className="sr-only">Your typhoon alert</h1>

        {/*
          One column on a phone, in reading order. On a laptop an active alert opens into rows that line up across two
          columns: status and choice, the header card and help, the alert and Ask, then the install note across both.
          Without an active alert there is only one column's worth, so the page stays one column.
        */}
        <div className={`flex flex-col gap-5 ${active ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-x-8 lg:gap-y-6' : ''}`}>
          {loading ? (
            <Skeleton />
          ) : areaKey ? (
            <HeaderCard alert={alert} area={area} household={household} className={active ? 'lg:col-start-1 lg:row-start-2' : ''} />
          ) : areas.length > 0 ? (
            <section aria-labelledby="choose-title" className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5">
              <h2 id="choose-title" className="text-title-lg">
                Choose your purok and household
              </h2>
              <p className="mt-1 text-body-lg text-on-surface-variant">This phone remembers them.</p>
              <ChoiceForm
                areas={areas}
                areaKey={undefined}
                household={household}
                submitLabel="Show my alert"
                onSubmit={(c) => choose(c)}
              />
            </section>
          ) : (
            <section className="rounded-xl bg-surface-container-high p-5">
              <p className="text-title-lg">No alerts from your barangay yet.</p>
              <p className="mt-1 text-body-lg text-on-surface-variant">Check again later, and listen to your barangay officials.</p>
            </section>
          )}

          <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-1">
            <Notice tone={TONES[line.tone]} role="status" className="lg:flex-1 lg:items-center">
              {line.text}
            </Notice>
            {sync.unreadable > 0 && (
              <Notice tone="warning">
                {sync.unreadable} alert{sync.unreadable === 1 ? '' : 's'} from the barangay couldn’t be read by this version of the
                app. Reload the page to get the latest version.
              </Notice>
            )}
          </div>

          {areaKey && (
            <div className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest py-2 pr-2 pl-4 lg:col-start-2 lg:row-start-1">
              <div className="min-w-0 flex-1">
                <p className="text-body-md text-on-surface-variant">Your purok and household</p>
                <p className="text-title-md">
                  {area} · {householdLabel(household)}
                </p>
              </div>
              <Button variant="outlined" onClick={() => setChanging(true)}>
                Change
              </Button>
            </div>
          )}

          {active && (
            // On a laptop the alert stretches to end level with the Ask card beside it, but not once an answer makes that card tall.
            <div className="space-y-5 lg:col-start-1 lg:row-start-3 lg:flex lg:flex-col lg:[main:has([data-ask=done],[data-ask=running])_&]:self-start">
              <AlertText alert={active.alert} languages={active.languages} shown={active.shown} onLanguage={(language) => choose({ language })} />
            </div>
          )}

          {active && <Hotline numbers={hotlineNumbers(active.shown.text)} className="lg:col-start-2 lg:row-start-2" />}
          {active && (
            <Ask
              key={`${active.alert.id}__${active.shown.language}`}
              setup={askSetup}
              online={sync.online}
              english={active.alert.texts.en}
              shown={active.shown.text}
              language={active.shown.language}
              names={[active.alert.stormName, active.alert.area]}
              className="lg:col-start-2 lg:row-start-3"
            />
          )}
          <InstallCard className={active ? 'lg:col-span-2 lg:row-start-4' : ''} />
        </div>
      </main>

      <Dialog open={changing} onClose={() => setChanging(false)} title="Your purok and household" side="bottom">
        {/* Mounted fresh each time it opens, so it starts from what the phone remembers. */}
        {changing && (
          <ChoiceForm
            areas={areas}
            areaKey={areaKey}
            household={household}
            submitLabel="Show this alert"
            onSubmit={(c) => {
              choose(c)
              setChanging(false)
            }}
            onCancel={() => setChanging(false)}
          />
        )}
      </Dialog>
    </>
  )
}

const PILL: Record<SyncPill['tone'], { box: string; dot: string }> = {
  ok: { box: 'bg-success-container text-on-success-container', dot: 'bg-success' },
  offline: { box: 'bg-surface-container-highest text-on-surface', dot: 'bg-outline' },
  problem: { box: 'bg-error-container text-on-error-container', dot: 'bg-error' },
}

/** The status in a word or two; the full line is under the header card. */
function StatusPill({ pill }: { pill: SyncPill }) {
  const { box, dot } = PILL[pill.tone]
  return (
    <p className={`inline-flex h-8 items-center gap-2 rounded-full px-3 text-label-lg whitespace-nowrap ${box}`}>
      <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />
      {pill.text}
    </p>
  )
}

/** Holds the space of the header card and the alert while the first alerts load, so nothing jumps. */
function Skeleton() {
  return (
    <div aria-hidden="true" className="space-y-5">
      <div className="h-36 animate-pulse rounded-xl bg-surface-container-high" />
      <div className="h-16 animate-pulse rounded-lg bg-surface-container-high" />
      <div className="h-40 animate-pulse rounded-lg bg-surface-container-high" />
    </div>
  )
}

/**
 * Storm, signal, area and household, and nothing else: every word here is in
 * the approved copy, so the page makes no safety claim the checker didn't see.
 */
function HeaderCard({
  alert,
  area,
  household,
  className = '',
}: {
  alert: PackAlert | undefined
  area: string
  household: HouseholdId
  className?: string
}) {
  const who = `${householdLabel(household)} households in ${area}`
  if (!alert) {
    return (
      <section className={`rounded-xl bg-surface-container-high p-5 ${className}`}>
        <p className="text-title-lg">No alert for {who} right now.</p>
        <p className="mt-1 text-body-lg text-on-surface-variant">Check again later, and listen to your barangay officials.</p>
      </section>
    )
  }
  if (alert.status === 'withdrawn') {
    return (
      <section className={`rounded-xl border border-outline bg-surface-container-highest p-5 ${className}`} role="alert">
        <p className="flex items-center gap-2 text-title-lg">
          <Icon name="block" className="size-6" />
          Alert withdrawn
        </p>
        <p className="mt-2 text-body-lg">The barangay withdrew the alert for {who}.</p>
        <p className="mt-1 text-body-lg">Don’t follow it. Wait for a new alert, and listen to your barangay officials.</p>
        {alert.updatedAtMs !== null && <p className="mt-2 text-body-md text-on-surface-variant">Withdrawn {at(alert.updatedAtMs)}</p>}
      </section>
    )
  }
  return (
    <section aria-label="Alert summary" className={`rounded-xl bg-error p-5 text-on-error ${className}`}>
      <p className="flex items-center gap-2 text-label-lg">
        <Icon name="warning" />
        {alert.stormName}
      </p>
      <p className="mt-2 text-display-sm font-bold">Signal No. {alert.signal}</p>
      <p className="mt-1 text-body-lg">
        {area} · {householdLabel(household)} households
      </p>
    </section>
  )
}

/** The approved text in the language chosen, with the language buttons once a translation exists. */
function AlertText({
  alert,
  languages,
  shown,
  onLanguage,
}: {
  alert: ActivePackAlert
  languages: Language[]
  shown: { text: string; language: Language }
  onLanguage: (language: Language) => void
}) {
  return (
    <>
      {languages.length > 1 && (
        <Segmented
          legend="Language"
          name="language"
          options={LANGUAGES.filter((l) => languages.includes(l.id)).map((l) => ({ value: l.id, label: l.label, lang: l.id }))}
          value={shown.language}
          onChange={onLanguage}
        />
      )}

      <section aria-labelledby="alert-title" className="lg:flex lg:flex-1 lg:flex-col">
        <h2 id="alert-title" className="text-title-md">
          Your alert
        </h2>
        <p className="mt-2 rounded-lg border-l-4 border-error bg-error-container p-4 text-title-lg leading-8 text-on-surface lg:flex-1" lang={shown.language}>
          {shown.text}
        </p>
        <p className="mt-3 text-body-md text-on-surface-variant">
          {alert.updatedAtMs !== null && <>Last updated {at(alert.updatedAtMs)} · </>}
          Approved by a barangay officer after a code check against the storm bulletin.
        </p>
      </section>
    </>
  )
}

/** The phone numbers in the alert shown, word for word, for a resident who needs help now. */
function Hotline({ numbers, className = '' }: { numbers: string[]; className?: string }) {
  if (numbers.length === 0) return null
  return (
    <section aria-labelledby="help-title" className={`rounded-lg bg-brand p-5 text-on-brand ${className}`}>
      <h2 id="help-title" className="flex items-center gap-2 text-title-md">
        <Icon name="call" />
        Need help?
      </h2>
      {numbers.map((n) => (
        <p key={n} className="mt-2 text-headline-sm font-medium tabular-nums">
          {n}
        </p>
      ))}
      <p className="mt-3 flex flex-wrap items-center gap-2 text-body-md text-on-brand-variant">
        <span className="rounded-sm border border-on-brand-variant px-2 text-label-md">Demo number</span>
        From your alert. In a real deployment this would be a call button.
      </p>
    </section>
  )
}

/**
 * Purok and household as two lists, first as a card on the first visit and
 * then in the "Change" sheet. Nothing changes until the resident confirms.
 */
function ChoiceForm({
  areas,
  areaKey,
  household,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  areas: Area[]
  areaKey: string | undefined
  household: HouseholdId
  submitLabel: string
  onSubmit: (choice: { areaKey: string; household: HouseholdId }) => void
  onCancel?: () => void
}) {
  // With one purok in the pack there is nothing to choose.
  const [purok, setPurok] = useState(areaKey ?? (areas.length === 1 ? areas[0].areaKey : undefined))
  const [who, setWho] = useState(household)
  const id = useId()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (purok) onSubmit({ areaKey: purok, household: who })
  }
  return (
    <form onSubmit={submit} className="mt-4 space-y-5">
      <ChoiceList
        legend="Your purok"
        name={`${id}-purok`}
        options={areas.map((a) => ({ value: a.areaKey, label: a.area }))}
        value={purok}
        onChange={setPurok}
      />
      <ChoiceList
        legend="Your household"
        name={`${id}-household`}
        options={HOUSEHOLDS.map((h) => ({ value: h.id, label: h.label }))}
        value={who}
        onChange={setWho}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="filled" size="lg" disabled={!purok}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="text" size="lg" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}

function ChoiceList<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string
  name: string
  options: { value: T; label: string }[]
  value: T | undefined
  onChange: (value: T) => void
}) {
  return (
    <fieldset>
      <legend className="text-title-sm">{legend}</legend>
      <div className="mt-1">
        {options.map((o) => (
          <label key={o.value} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-2 text-body-lg hover:bg-on-surface/8">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={o.value === value}
              onChange={() => onChange(o.value)}
              className="size-5 accent-primary"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** Chrome's install prompt event, which TypeScript's DOM types don't include. */
type InstallPrompt = Event & { prompt: () => Promise<void> }

function offlineAppText(app: OfflineApp): string {
  switch (app.state) {
    case 'ready':
      return 'This page and your barangay’s alerts are saved on this phone, so they open with no signal.'
    case 'starting':
      return 'Saving this page on the phone for offline use…'
    case 'unavailable':
      return `Your barangay’s alerts are saved on this phone, but this page itself isn’t, so opening it needs a signal. ${app.reason}`
  }
}

const MODE = installMode({
  standalone: window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true,
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  maxTouchPoints: navigator.maxTouchPoints,
})

/**
 * Says whether the page opens with no signal, and how to put it on the home
 * screen: Chrome's install prompt where it offers one, Safari's steps on iOS.
 */
function InstallCard({ className = '' }: { className?: string }) {
  const [prompt, setPrompt] = useState<InstallPrompt>()
  const [installError, setInstallError] = useState<string>()
  const offlineApp = useOfflineApp()

  useEffect(() => {
    const keep = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallPrompt)
    }
    window.addEventListener('beforeinstallprompt', keep)
    return () => window.removeEventListener('beforeinstallprompt', keep)
  }, [])

  const install = () => {
    prompt
      ?.prompt()
      .then(() => setPrompt(undefined))
      .catch((err: unknown) => setInstallError(err instanceof Error ? err.message : String(err)))
  }

  return (
    <section className={`rounded-lg bg-surface-container p-4 text-body-md text-on-surface-variant ${className}`}>
      <p>
        {offlineAppText(offlineApp)}
        {MODE === 'other' && ' Add it to your home screen to find it fast.'}
      </p>
      {MODE === 'ios' && (
        <p className="mt-2">
          To add it to your home screen, tap Share <Icon name="ios_share" className="inline size-4 align-text-bottom" />, then
          Add to Home Screen. The Home Screen app keeps its own storage: open it once with a signal and choose your purok and
          household again before it works offline.
        </p>
      )}
      {MODE === 'other' && prompt && (
        <Button size="lg" variant="tonal" className="mt-3" onClick={install}>
          Install on this phone
        </Button>
      )}
      {installError && <p className="mt-2 text-error">Couldn’t install: {installError}</p>}
    </section>
  )
}
