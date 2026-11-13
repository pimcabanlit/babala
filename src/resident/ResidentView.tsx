import { useEffect, useState } from 'react'
import Ask from './Ask'
import { formatTime } from '../console/format'
import { HOUSEHOLDS, type HouseholdId } from '../drafting/households'
import { getFirebase } from '../firebase'
import type { OfflineApp } from '../offline/register'
import { useOfflineApp } from '../offline/useOfflineApp'
import { LANGUAGES, alertFor, languagesOf, packAreas, textIn, type Language, type PackAlert } from './pack'
import { useAskSetup, type AskSetup } from './useAsk'
import { useChoice, useResidentPack } from './useResidentPack'
import { syncLine } from './view'
import Button from '../ui/Button'
import Notice from '../ui/Notice'

const TONES = {
  ok: 'success',
  offline: 'neutral',
  problem: 'error',
} as const

const at = (ms: number) => formatTime(new Date(ms))

/**
 * The resident's page, for any phone browser: pick your purok and household
 * once, and read your alert. It opens from the pack saved on the phone first,
 * so it works with no signal.
 */
export default function ResidentView() {
  const { pack, sync } = useResidentPack(getFirebase())
  const askSetup = useAskSetup(getFirebase())
  const [choice, choose] = useChoice()
  const areas = packAreas(pack)
  const areaKey = areas.some((a) => a.areaKey === choice.areaKey) ? choice.areaKey : undefined
  const household = choice.household ?? 'general'
  const alert = areaKey ? alertFor(pack, household, areaKey) : undefined
  const line = syncLine(sync, at)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-headline-sm">Your typhoon alert</h1>
        <Notice tone={TONES[line.tone]} role="status" className="mt-3">
          {line.text}
        </Notice>
        {sync.unreadable > 0 && (
          <Notice tone="warning" className="mt-3">
            {sync.unreadable} alert{sync.unreadable === 1 ? '' : 's'} from the barangay couldn’t be read by this version of the
            app. Reload the page to get the latest version.
          </Notice>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-body-md font-medium">
          Your purok
          <select
            className="field mt-1 block font-normal"
            value={areaKey ?? ''}
            onChange={(e) => choose({ areaKey: e.target.value })}
            disabled={areas.length === 0}
          >
            <option value="" disabled>
              {areas.length === 0 ? 'No alerts yet' : 'Choose your purok'}
            </option>
            {areas.map((a) => (
              <option key={a.areaKey} value={a.areaKey}>
                {a.area}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-body-md font-medium">
          Your household
          <select
            className="field mt-1 block font-normal"
            value={household}
            onChange={(e) => choose({ household: e.target.value as HouseholdId })}
          >
            {HOUSEHOLDS.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {areaKey ? (
        <AlertCard
          alert={alert}
          household={household}
          area={areas.find((a) => a.areaKey === areaKey)?.area ?? ''}
          language={choice.language ?? 'en'}
          onLanguage={(language) => choose({ language })}
          askSetup={askSetup}
          online={sync.online}
        />
      ) : (
        areas.length > 0 && <p className="text-body-lg text-on-surface-variant">Choose your purok to see your alert. This phone remembers it.</p>
      )}

      <InstallHint />
    </div>
  )
}

function householdLabel(id: HouseholdId): string {
  return HOUSEHOLDS.find((h) => h.id === id)?.label ?? id
}

function AlertCard({
  alert,
  household,
  area,
  language,
  onLanguage,
  askSetup,
  online,
}: {
  alert: PackAlert | undefined
  household: HouseholdId
  area: string
  language: Language
  onLanguage: (language: Language) => void
  askSetup: AskSetup
  online: boolean
}) {
  const who = `${householdLabel(household)} households in ${area}`
  if (!alert) {
    return (
      <p className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 text-body-lg">
        No alert for {who} right now. Check again later, and listen to your barangay officials.
      </p>
    )
  }
  if (alert.status === 'withdrawn') {
    return (
      <div className="rounded-lg border border-outline bg-surface-container-high p-4 text-body-lg" role="alert">
        <p className="text-title-md">The barangay withdrew the alert for {who}.</p>
        <p className="mt-1">Don’t follow it. Wait for a new alert, and listen to your barangay officials.</p>
        {alert.updatedAtMs !== null && <p className="mt-2 text-body-md text-on-surface-variant">Withdrawn {at(alert.updatedAtMs)}</p>}
      </div>
    )
  }
  const languages = languagesOf(alert)
  const shown = textIn(alert, language)
  return (
    <article className="rounded-lg border-2 border-error bg-surface-container-lowest p-4">
      <p className="text-title-sm text-error">
        {alert.stormName} · Signal No. {alert.signal} · {who}
      </p>
      {languages.length > 1 && (
        <label className="mt-4 block text-body-md font-medium">
          Language
          <select
            className="field mt-1 block font-normal"
            value={shown.language}
            onChange={(e) => onLanguage(e.target.value as Language)}
          >
            {LANGUAGES.filter((l) => languages.includes(l.id)).map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <p className="mt-4 text-title-lg leading-8" lang={shown.language}>
        {shown.text}
      </p>
      <p className="mt-4 text-body-md text-on-surface-variant">
        {alert.updatedAtMs !== null && <>Last updated {at(alert.updatedAtMs)}. </>}
        Approved by a barangay officer after a code check against the storm bulletin.
      </p>
      <Ask
        key={`${alert.id}__${shown.language}`}
        setup={askSetup}
        online={online}
        english={alert.texts.en}
        shown={shown.text}
        language={shown.language}
        names={[alert.stormName, alert.area]}
      />
    </article>
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

/**
 * Says whether the page opens with no signal, and offers to install it where
 * Chrome allows, so it opens from the home screen.
 */
function InstallHint() {
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
    <div className="rounded-md bg-surface-container p-4 text-body-md text-on-surface-variant">
      <p>{offlineAppText(offlineApp)} Add it to your home screen to find it fast.</p>
      {prompt && (
        <Button size="lg" variant="tonal" className="mt-3" onClick={install}>
          Install on this phone
        </Button>
      )}
      {installError && <p className="mt-2 text-error">Couldn’t install: {installError}</p>}
    </div>
  )
}
