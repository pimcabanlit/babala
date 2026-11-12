/**
 * An approved alert as saved in Firestore at `alerts/{household}__{areaKey}`:
 * one current alert per household type and area, replaced by the next approval.
 * Pure code, so the console and the rules tests build exactly the same document.
 *
 * firestore.rules checks the same fields and limits. Change both together.
 */
import type { FactSheet } from '../checker'
import { checkFor } from '../drafting/check'
import { HOUSEHOLDS, type Household, type HouseholdId } from '../drafting/households'

export const ALERTS = 'alerts'

/** Size limits, the same numbers as in firestore.rules. */
export const LIMITS = {
  text: 1000,
  area: 80,
  stormName: 100,
  signals: 30,
  landfallDate: 30,
  evacuationCentres: 20,
  puroks: 50,
  barangays: 20,
  hotline: 40,
  otherFigures: 30,
  bulletinText: 20000,
} as const

/**
 * Which model wrote the text the officer approved: the laptop's (on_device),
 * the cloud's (in_cloud), none (the officer typed it), or unknown (the SDK
 * didn't say).
 */
export type AlertSource = 'on_device' | 'in_cloud' | 'none' | 'unknown'
export const ALERT_SOURCES: readonly AlertSource[] = ['on_device', 'in_cloud', 'none', 'unknown']

/** What the app writes. store.ts adds approvedBy and approvedAt. */
export type AlertRecord = {
  household: HouseholdId
  /** The area as the fact sheet writes it, e.g. "Purok Ilaya". */
  area: string
  /** The area in the document ID, e.g. "purok-ilaya". */
  areaKey: string
  /** The area's signal number from the fact sheet. */
  signal: number
  /** The alert exactly as the checker passed it. */
  text: string
  /** The confirmed fact sheet, bulletin included, so the alert can be re-checked later. */
  factSheet: FactSheet
  source: AlertSource
  /** The officer changed the model's text, or typed it. */
  edited: boolean
}

export type ApprovalInput = {
  text: string
  sheet: FactSheet
  area: string
  household: Household
  claimWords: string[]
  source: AlertSource
  edited: boolean
}

export type Approval = { ok: true; id: string; record: AlertRecord } | { ok: false; reason: string }

/**
 * "Purok Niño 2" → "purok-nino-2": lower case, accents dropped, anything else
 * becomes one dash. Undefined when nothing is left, e.g. for "—".
 */
export function areaKey(area: string): string | undefined {
  const key = area
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replaceAll(' ', '-')
  return key === '' ? undefined : key
}

export function alertDocId(household: HouseholdId, key: string): string {
  return `${household}__${key}`
}

/**
 * The document to save when an officer approves an alert, or why it can't be
 * saved. It runs the checker again on the exact text, so no path saves an
 * alert that fails it, whatever the button state was.
 */
export function approvedAlert(input: ApprovalInput): Approval {
  const { sheet, area, household } = input
  const text = input.text.trim()

  const signal = sheet.signals.find((s) => s.area === area)?.signal
  if (signal === undefined) return { ok: false, reason: `“${area}” is not an area in the fact sheet.` }
  const key = areaKey(area)
  if (key === undefined) return { ok: false, reason: `The area name “${area}” needs at least one letter or number.` }
  // An empty list would let every added claim through (checker rule 5).
  if (input.claimWords.length === 0) return { ok: false, reason: 'The checker’s word list hasn’t loaded yet. Try again in a moment.' }

  const check = checkFor(text, sheet, area, household, input.claimWords)
  if (!check.pass) {
    const first = check.issues[0]?.message ?? 'see the problems listed'
    return { ok: false, reason: `The alert fails the checker: ${first}` }
  }

  const record: AlertRecord = {
    household: household.id,
    area,
    areaKey: key,
    signal,
    text,
    factSheet: plainSheet(sheet),
    source: input.source,
    edited: input.edited,
  }
  const tooBig = sizeProblem(record)
  if (tooBig) return { ok: false, reason: tooBig }
  return { ok: true, id: alertDocId(household.id, key), record }
}

/** A copy with only the fact sheet's own fields and no undefined values, which Firestore refuses. */
function plainSheet(s: FactSheet): FactSheet {
  return {
    stormName: s.stormName,
    signals: s.signals.map(({ area, signal }) => ({ area, signal })),
    landfallTime: s.landfallTime,
    ...(s.landfallDate ? { landfallDate: s.landfallDate } : {}),
    evacuationCentres: [...s.evacuationCentres],
    puroks: [...s.puroks],
    barangays: [...s.barangays],
    hotline: s.hotline,
    otherFigures: [...(s.otherFigures ?? [])],
    bulletinText: s.bulletinText,
  }
}

/** The first value over a limit in LIMITS, as the officer would fix it. */
function sizeProblem(r: AlertRecord): string | undefined {
  const s = r.factSheet
  const checks: [string, number, number][] = [
    ['The alert text', r.text.length, LIMITS.text],
    ['The area name', r.area.length, LIMITS.area],
    ['The storm name', s.stormName.length, LIMITS.stormName],
    ['The list of signals', s.signals.length, LIMITS.signals],
    ['The landfall date', (s.landfallDate ?? '').length, LIMITS.landfallDate],
    ['The list of evacuation centres', s.evacuationCentres.length, LIMITS.evacuationCentres],
    ['The list of puroks', s.puroks.length, LIMITS.puroks],
    ['The list of barangays', s.barangays.length, LIMITS.barangays],
    ['The hotline', s.hotline.length, LIMITS.hotline],
    ['The list of other figures', (s.otherFigures ?? []).length, LIMITS.otherFigures],
    ['The bulletin', s.bulletinText.length, LIMITS.bulletinText],
  ]
  const over = checks.find(([, size, max]) => size > max)
  return over ? `${over[0]} is too long to save (at most ${over[2].toLocaleString('en')}).` : undefined
}

/** A saved alert as the console shows it. */
export type SavedAlert = {
  id: string
  household: HouseholdId
  area: string
  text: string
  source: AlertSource
  edited: boolean
  /** The server's time, or the laptop's estimate while the save waits to upload. */
  approvedAt: Date | undefined
  /** Saved on this laptop, not yet uploaded. */
  pending: boolean
  /** The ledger entry that records this approval. Undefined for alerts saved before the ledger. */
  ledgerId: string | undefined
}

/** Reads a saved alert's fields; undefined if the document isn't one. */
export function readSavedAlert(
  id: string,
  data: Record<string, unknown>,
  approvedAt: Date | undefined,
  pending: boolean,
): SavedAlert | undefined {
  const { household, area, text, source, edited, ledgerId } = data
  if (!HOUSEHOLDS.some((h) => h.id === household)) return undefined
  if (typeof area !== 'string' || typeof text !== 'string' || typeof edited !== 'boolean') return undefined
  if (!ALERT_SOURCES.includes(source as AlertSource)) return undefined
  if (ledgerId !== undefined && typeof ledgerId !== 'string') return undefined
  return { id, household: household as HouseholdId, area, text, source: source as AlertSource, edited, approvedAt, pending, ledgerId }
}
