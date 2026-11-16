/**
 * Pure helpers for *Create an alert*: the greeting, the storm summary, which
 * facts open as fields, why drafting is off, each household tab's state, and
 * the words for each draft attempt. No React or Firebase here.
 */
import { InferenceSource } from '../ai'
import type { DeviceStatus } from '../ai/deviceStatus'
import type { FactSheet, Rule } from '../checker'
import { to12h, type FactSheetForm } from '../factsheet/form'
import type { SignInMethod } from '../officer/status'
import type { Attempt } from './useDrafts'

/**
 * "Good afternoon, Pim": the time of day from the laptop's clock, and the
 * first name from the Google profile. The shared test officer has no name of
 * its own, so it gets the greeting alone.
 */
export function greeting(hour: number, user: { name: string; method: SignInMethod }): string {
  const part = hour >= 5 && hour < 12 ? 'Good morning' : hour >= 12 && hour < 18 ? 'Good afternoon' : 'Good evening'
  const first = user.method === 'google' ? user.name.trim().split(/\s+/)[0] : ''
  return first ? `${part}, ${first}` : part
}

export type StormSummary = { line: string; areas: { area: string; signal: number }[] }

/**
 * The confirmed storm in one line, "Demo storm · Typhoon Sample · Landfall
 * Nov 14, 6:00 PM", and each area's signal. Built only from the confirmed
 * fact sheet, so it never says more than the officer checked.
 */
export function stormSummary(sheet: FactSheet): StormSummary {
  const landfall = [sheet.landfallDate, to12h(sheet.landfallTime)].filter(Boolean).join(', ')
  const line = ['Demo storm', sheet.stormName.trim(), `Landfall ${landfall}`].filter(Boolean).join(' · ')
  return { line, areas: sheet.signals.map(({ area, signal }) => ({ area, signal })) }
}

/** The fact sheet fields for the names parseBulletin gives the facts it didn't find. */
const NOT_FOUND_FIELD: Record<string, keyof FactSheetForm> = {
  'storm name': 'stormName',
  'signal numbers': 'signals',
  'landfall time': 'landfallTime',
  'evacuation centres': 'evacuationCentres',
  hotline: 'hotline',
}

/** The fields that open for the officer to fill in: the facts the bulletin didn't give. */
export function openFactFields(notFound: string[]): (keyof FactSheetForm)[] {
  return notFound.map((name) => NOT_FOUND_FIELD[name]).filter((key) => key !== undefined)
}

/**
 * Why the draft buttons are off, or undefined when drafting can start. The
 * officer can still write and check an alert by hand in every case.
 */
export function draftBlockReason(s: { modelsReady: boolean; online: boolean; device: DeviceStatus; busy: boolean }): string | undefined {
  if (!s.online && s.device !== 'available')
    return 'Offline, and this laptop has no on-device model, so drafting waits for the connection. You can still write an alert by hand.'
  if (!s.modelsReady) return 'Loading the model settings…'
  if (s.busy) return 'One alert drafts at a time. Wait for the one in progress.'
  return undefined
}

export type TabStatus = 'empty' | 'drafting' | 'fails' | 'passes' | 'approved'

/** Where one household's alert stands, for its tab's icon and its panel's chip. */
export function tabStatus(d: { running: boolean; approved: boolean; passed: boolean | undefined }): TabStatus {
  if (d.running) return 'drafting'
  if (d.approved) return 'approved'
  if (d.passed === undefined) return 'empty'
  return d.passed ? 'passes' : 'fails'
}

export const TAB_STATUS_TEXT: Record<TabStatus, string> = {
  empty: 'Not drafted',
  drafting: 'Drafting',
  fails: 'Fails a check',
  passes: 'Passes, not approved',
  approved: 'Approved',
}

/**
 * The six checks every alert passes before it can be approved
 * (docs/data-schema.md, "Checker rules" 1 to 6), named as the officer reads them.
 */
export const DRAFT_CHECKS: { rule: Rule; label: string }[] = [
  { rule: 'figures', label: 'Figures' },
  { rule: 'places', label: 'Places' },
  { rule: 'missing', label: 'Nothing missing' },
  { rule: 'placeholders', label: 'No placeholders' },
  { rule: 'added-claims', label: 'No added claims' },
  { rule: 'plain', label: 'Plain and short' },
]

/** A free-tier quota or rate limit from the cloud, which passes in a minute or so. */
export function isBusyError(error: string): boolean {
  return /\b429\b|quota|resource.?exhausted|too many/i.test(error)
}

/** An attempt's error as the officer reads it: "busy" for a quota, otherwise the error itself. */
export function attemptError(error: string): string {
  return isBusyError(error) ? 'The cloud is busy right now. Try again shortly.' : error
}

/** Where an attempt ran, once the first words show it, in words for a sentence. */
function where(a: Attempt): string | undefined {
  if (a.source === InferenceSource.ON_DEVICE) return 'on this laptop'
  if (a.source === InferenceSource.IN_CLOUD || a.route === 'only_in_cloud') return 'in the cloud'
  return undefined
}

/** The running attempt in a few words, without the seconds: "Retrying on this laptop, with an edit per problem". */
export function progressText(a: Attempt): string {
  const place = where(a)
  const verb = a.retry ? 'Retrying' : 'Drafting'
  return `${place ? `${verb} ${place}` : verb}${a.retry ? ', with an edit per problem' : ''}`
}

/** One attempt in the history: what it was, how long it took, and how it ended. */
export function attemptText(a: Attempt, runningMs: number | undefined): string {
  const kind = a.retry ? 'Retry with an edit per problem' : 'Draft'
  if (a.endedMs === undefined) return `${kind} · ${((runningMs ?? 0) / 1000).toFixed(0)} s`
  const time = `${(a.endedMs / 1000).toFixed(1)} s`
  if (a.abandoned) return `${kind} · stopped waiting after ${time}`
  if (a.error) return `${kind} · error after ${time}: ${attemptError(a.error)}`
  if (a.passed === undefined) return `${kind} · ${time}`
  const problems = a.issues?.length ?? 0
  return `${kind} · ${time} · ${a.passed ? 'passed' : `failed (${problems} problem${problems === 1 ? '' : 's'})`}`
}

/** The history folded into one line: "2 tries: failed, then passed". */
export function historySummary(attempts: Attempt[]): string {
  const ends = attempts.map((a) => {
    if (a.endedMs === undefined) return 'drafting'
    if (a.abandoned) return 'stopped waiting'
    if (a.error) return 'error'
    return a.passed ? 'passed' : 'failed'
  })
  return `${attempts.length} ${attempts.length === 1 ? 'try' : 'tries'}: ${ends.join(', then ')}`
}

/** What the snackbar says when a change clears approvals, or nothing when there were none to clear. */
export function approvalsCleared(cause: 'facts' | 'unconfirmed' | 'area', count: number): string | undefined {
  if (count === 0) return undefined
  const what = { facts: 'The facts changed', unconfirmed: 'The facts need confirming again', area: 'The area changed' }[cause]
  const approvals = count === 1 ? '1 approval was' : `${count} approvals were`
  return `${what}, so ${approvals} cleared. Saved alerts stay as they are until you approve new ones.`
}

/** What the snackbar says when reading a bulletin again clears the drafts, or nothing when there were none. */
export function draftsCleared(count: number): string | undefined {
  if (count === 0) return undefined
  return `Bulletin read again, so the ${count === 1 ? 'draft was' : `${count} drafts were`} cleared. Saved alerts stay as they are until you approve new ones.`
}
