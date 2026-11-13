/**
 * The offline pack: every resident copy of the barangay's alerts
 * (src/alerts/residentCopy.ts), saved on the phone so the resident view opens
 * with no signal. Pure code: reading copies, saving and loading the pack, and
 * picking the resident's alert and language.
 */
import { HOUSEHOLDS, type HouseholdId } from '../drafting/households'

/** English always; Filipino and Cebuano once an alert has a checked translation. */
export type Language = 'en' | 'fil' | 'ceb'

export const LANGUAGES: readonly { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'fil', label: 'Filipino' },
  { id: 'ceb', label: 'Cebuano (Bisaya)' },
]

type Place = {
  /** The alert's ID, `{household}__{areaKey}`. */
  id: string
  household: HouseholdId
  area: string
  areaKey: string
  /** When the barangay approved or withdrew it (server time, ms since 1970); null if unknown. */
  updatedAtMs: number | null
}

export type ActivePackAlert = Place & {
  status: 'active'
  signal: number
  stormName: string
  /** The approved English alert, and any checked translations, by language. */
  texts: { en: string } & Partial<Record<Exclude<Language, 'en'>, string>>
}

export type WithdrawnPackAlert = Place & { status: 'withdrawn' }

export type PackAlert = ActivePackAlert | WithdrawnPackAlert

export type Pack = {
  /** When the phone last got the pack from the server (ms since 1970). */
  savedAtMs: number
  alerts: PackAlert[]
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Reads one resident copy, as Firestore or the saved pack holds it; undefined
 * if it isn't one. The caller turns the Firestore timestamp into ms.
 * Translations are read from `translations: { fil: { text }, ceb: { text } }`;
 * a malformed or empty one is left out, so the resident still gets English.
 */
export function readPackAlert(id: string, data: Record<string, unknown>, updatedAtMs: number | null): PackAlert | undefined {
  const { household, area, areaKey, status } = data
  if (!HOUSEHOLDS.some((h) => h.id === household)) return undefined
  if (typeof area !== 'string' || area === '' || typeof areaKey !== 'string' || areaKey === '') return undefined
  if (id !== `${household as string}__${areaKey}`) return undefined
  const place: Place = { id, household: household as HouseholdId, area, areaKey, updatedAtMs }
  if (status === 'withdrawn') return { ...place, status }
  if (status !== 'active') return undefined
  const { signal, stormName, text } = data
  if (typeof signal !== 'number' || !Number.isInteger(signal) || typeof stormName !== 'string') return undefined
  if (typeof text !== 'string' || text.trim() === '') return undefined
  const texts: ActivePackAlert['texts'] = { en: text }
  const translations = isRecord(data.translations) ? data.translations : {}
  for (const { id: lang } of LANGUAGES) {
    if (lang === 'en') continue
    const t = translations[lang]
    if (isRecord(t) && typeof t.text === 'string' && t.text.trim() !== '') texts[lang] = t.text
  }
  return { ...place, status, signal, stormName, texts }
}

/** The pack as saved on the phone. Translations are kept in the same shape Firestore uses. */
export function packToJson(pack: Pack): string {
  return JSON.stringify({
    savedAtMs: pack.savedAtMs,
    alerts: pack.alerts.map((a) => {
      if (a.status === 'withdrawn') return a
      const { texts, ...rest } = a
      const translations = Object.fromEntries(
        Object.entries(texts)
          .filter(([lang]) => lang !== 'en')
          .map(([lang, text]) => [lang, { text }]),
      )
      return { ...rest, text: texts.en, translations }
    }),
  })
}

/**
 * The pack saved on the phone, or undefined if there is none or it can't be
 * read (from an older version, or edited by hand). Copies it can't read are
 * dropped, the rest kept.
 */
export function packFromJson(json: string | null): Pack | undefined {
  if (json === null) return undefined
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    // A broken save is the same as none: the next sync replaces it.
    return undefined
  }
  if (!isRecord(raw) || typeof raw.savedAtMs !== 'number' || !Array.isArray(raw.alerts)) return undefined
  const alerts: PackAlert[] = []
  for (const item of raw.alerts) {
    if (!isRecord(item) || typeof item.id !== 'string') continue
    const at = typeof item.updatedAtMs === 'number' ? item.updatedAtMs : null
    const alert = readPackAlert(item.id, item, at)
    if (alert) alerts.push(alert)
  }
  return { savedAtMs: raw.savedAtMs, alerts }
}

/** The areas in the pack, each once, in a natural order ("Purok 2" before "Purok 10"). */
export function packAreas(pack: Pack | undefined): { areaKey: string; area: string }[] {
  const byKey = new Map<string, string>()
  for (const a of pack?.alerts ?? []) if (!byKey.has(a.areaKey)) byKey.set(a.areaKey, a.area)
  return [...byKey]
    .map(([areaKey, area]) => ({ areaKey, area }))
    .sort((x, y) => x.area.localeCompare(y.area, 'en', { numeric: true, sensitivity: 'base' }))
}

export function alertFor(pack: Pack | undefined, household: HouseholdId, areaKey: string): PackAlert | undefined {
  return pack?.alerts.find((a) => a.household === household && a.areaKey === areaKey)
}

/** The languages this alert can be read in, English first. */
export function languagesOf(alert: PackAlert | undefined): Language[] {
  if (alert?.status !== 'active') return ['en']
  return LANGUAGES.map((l) => l.id).filter((id) => alert.texts[id] !== undefined)
}

/** The alert in the chosen language, or in English when it has no translation into it. */
export function textIn(alert: ActivePackAlert, language: Language): { language: Language; text: string } {
  const text = alert.texts[language]
  return text === undefined ? { language: 'en', text: alert.texts.en } : { language, text }
}

/** What the resident picked, remembered on the phone. */
export type Choice = { areaKey: string; household: HouseholdId; language: Language }

export function choiceFromJson(json: string | null): Partial<Choice> {
  if (json === null) return {}
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    // A broken save means the resident picks again.
    return {}
  }
  if (!isRecord(raw)) return {}
  const choice: Partial<Choice> = {}
  if (typeof raw.areaKey === 'string') choice.areaKey = raw.areaKey
  if (HOUSEHOLDS.some((h) => h.id === raw.household)) choice.household = raw.household as HouseholdId
  if (LANGUAGES.some((l) => l.id === raw.language)) choice.language = raw.language as Language
  return choice
}
