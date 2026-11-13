import { useEffect, useState } from 'react'
import { formatTime } from '../console/format'
import { HOUSEHOLDS, type HouseholdId } from '../drafting/households'
import { getFirebase } from '../firebase'
import { startOfflineApp, type OfflineApp } from '../offline/register'
import { LANGUAGES, alertFor, languagesOf, packAreas, textIn, type Language, type PackAlert } from './pack'
import { useChoice, useResidentPack } from './useResidentPack'
import { syncLine } from './view'

const TONES = {
  ok: 'bg-emerald-50 text-emerald-900',
  offline: 'bg-slate-200 text-slate-900',
  problem: 'bg-red-50 text-red-800',
} as const

const at = (ms: number) => formatTime(new Date(ms))

/**
 * The resident's page, for any phone browser: pick your purok and household
 * once, and read your alert. It opens from the pack saved on the phone first,
 * so it works with no signal.
 */
export default function ResidentView() {
  const { pack, sync } = useResidentPack(getFirebase())
  const [choice, choose] = useChoice()
  const areas = packAreas(pack)
  const areaKey = areas.some((a) => a.areaKey === choice.areaKey) ? choice.areaKey : undefined
  const household = choice.household ?? 'general'
  const alert = areaKey ? alertFor(pack, household, areaKey) : undefined
  const line = syncLine(sync, at)

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Your typhoon alert</h2>
        <p className={`mt-2 rounded p-2 text-sm ${TONES[line.tone]}`} role="status">
          {line.text}
        </p>
        {sync.unreadable > 0 && (
          <p className="mt-2 rounded bg-amber-100 p-2 text-sm text-amber-950">
            {sync.unreadable} alert{sync.unreadable === 1 ? '' : 's'} from the barangay couldn’t be read by this version of the
            app. Reload the page to get the latest version.
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-semibold">
          Your purok
          <select
            className="mt-1 block w-full rounded border border-slate-300 bg-white p-2 text-base font-normal"
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
        <label className="block text-sm font-semibold">
          Your household
          <select
            className="mt-1 block w-full rounded border border-slate-300 bg-white p-2 text-base font-normal"
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
        <AlertCard alert={alert} household={household} area={areas.find((a) => a.areaKey === areaKey)?.area ?? ''} language={choice.language ?? 'en'} onLanguage={(language) => choose({ language })} />
      ) : (
        areas.length > 0 && <p className="text-slate-700">Choose your purok to see your alert. This phone remembers it.</p>
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
}: {
  alert: PackAlert | undefined
  household: HouseholdId
  area: string
  language: Language
  onLanguage: (language: Language) => void
}) {
  const who = `${householdLabel(household)} households in ${area}`
  if (!alert) {
    return (
      <p className="rounded border border-slate-300 bg-white p-4 text-slate-800">
        No alert for {who} right now. Check again later, and listen to your barangay officials.
      </p>
    )
  }
  if (alert.status === 'withdrawn') {
    return (
      <div className="rounded border border-slate-400 bg-white p-4 text-slate-800" role="alert">
        <p className="font-semibold">The barangay withdrew the alert for {who}.</p>
        <p className="mt-1">Don’t follow it. Wait for a new alert, and listen to your barangay officials.</p>
        {alert.updatedAtMs !== null && <p className="mt-2 text-sm text-slate-600">Withdrawn {at(alert.updatedAtMs)}</p>}
      </div>
    )
  }
  const languages = languagesOf(alert)
  const shown = textIn(alert, language)
  return (
    <article className="rounded border-2 border-red-700 bg-white p-4">
      <p className="text-sm font-semibold text-red-800">
        {alert.stormName} · Signal No. {alert.signal} · {who}
      </p>
      {languages.length > 1 && (
        <label className="mt-3 block text-sm font-semibold">
          Language
          <select
            className="mt-1 block w-full rounded border border-slate-300 bg-white p-2 text-base font-normal"
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
      <p className="mt-3 text-lg leading-relaxed" lang={shown.language}>
        {shown.text}
      </p>
      <p className="mt-3 text-sm text-slate-600">
        {alert.updatedAtMs !== null && <>Last updated {at(alert.updatedAtMs)}. </>}
        Approved by a barangay officer after a code check against the storm bulletin.
      </p>
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
  const [offlineApp, setOfflineApp] = useState<OfflineApp>({ state: 'starting' })

  useEffect(() => {
    let current = true
    void startOfflineApp().then((app) => {
      if (current) setOfflineApp(app)
    })
    return () => {
      current = false
    }
  }, [])

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
    <div className="rounded bg-slate-100 p-3 text-sm text-slate-700">
      <p>{offlineAppText(offlineApp)} Add it to your home screen to find it fast.</p>
      {prompt && (
        <button type="button" className="mt-2 rounded bg-slate-900 px-3 py-2 font-semibold text-white" onClick={install}>
          Install on this phone
        </button>
      )}
      {installError && <p className="mt-1 text-red-800">Couldn’t install: {installError}</p>}
    </div>
  )
}
