/**
 * The ledger: a locked record of every change to a saved alert, in Firestore
 * at `ledger/{entryId}`. Two kinds of change today: an approval and a
 * withdrawal. Translations add their own kind of entry later.
 *
 * Each change writes the alert and its entry in one batch, and firestore.rules
 * refuses either one without the other, so no alert changes without its
 * record. Entries can't be changed or deleted, so a later approval replaces the
 * alert but never its history.
 *
 * Pure code, so the console and the rules tests build exactly the same
 * documents. firestore.rules checks the same fields and limits. Change both together.
 */
import type { Route } from '../ai'
import type { Rule } from '../checker'
import { ALERT_SOURCES, type AlertRecord, type AlertSource, type Approval, type SavedAlert } from '../alerts/record'
import { activeCopy, withdrawnCopy, type ActiveCopy, type WithdrawnCopy } from '../alerts/residentCopy'
import { HOUSEHOLDS } from '../drafting/households'

export const LEDGER = 'ledger'

/**
 * Size limits. The list limits are the same numbers as in firestore.rules.
 * Rules can't look inside list items, so the app clips each draft's text
 * fields itself, to keep an entry well under Firestore's 1 MiB limit.
 */
export const LEDGER_LIMITS = {
  drafts: 20,
  claimWords: 500,
  cloudModel: 100,
  prompt: 6000,
  draftText: 2000,
  issues: 30,
  issueMessage: 300,
  error: 500,
  reason: 300,
} as const

/** How a model call ended: the checker passed or failed its text, it threw, or the officer stopped waiting. */
export type DraftOutcome = 'passed' | 'failed' | 'error' | 'stopped'

/** Which model answered, as the SDK reported it. */
export type DraftSource = Exclude<AlertSource, 'none'>

/** One model call behind an approved alert. */
export type LedgerDraft = {
  /** 1 for the first "Draft" on the card, 2 after "Draft again", and so on. */
  round: number
  route: Route
  /** The prompt quoted the last draft with an edit per problem. */
  retry: boolean
  /** The area it was drafted for. Usually the alert's own area. */
  area: string
  source: DraftSource
  /** The exact prompt, so the record shows the facts the model was given. */
  prompt: string
  /** The answer's fields joined into the alert, as the checker saw it. */
  text: string
  outcome: DraftOutcome
  /** The checker's problems with the text: empty when it passed. */
  issues: { rule: Rule; message: string }[]
  /** The error, when the call threw. Empty otherwise. */
  error: string
  /** When the call started, by the laptop's clock (milliseconds since 1970). */
  startedAtMs: number
  /** Time to the first streamed text, or null when none came. */
  firstTextMs: number | null
  totalMs: number
}

/** The record of one approval: what the alert says, where it came from, and the drafts behind it. */
export type ApprovedEntry = AlertRecord & {
  kind: 'approved'
  /** The alert this approval saved, `{household}__{areaKey}`. */
  alertId: string
  /** The cloud model the console used for its cloud drafts, from Remote Config. */
  cloudModel: string
  /** The checker's claim-word list (rule 5) when the alert was approved, so the check can be repeated. */
  claimWords: string[]
  /** The model calls on the card since its last approval, oldest first. */
  drafts: LedgerDraft[]
  /** Older drafts left out to stay within LEDGER_LIMITS.drafts. */
  draftsOmitted: number
}

/** The saved alert, pointing at the entry that records its approval. */
export type LinkedAlert = AlertRecord & { ledgerId: string }

/** What the console knows about the approval, besides the alert itself. */
export type Trail = {
  drafts: LedgerDraft[]
  cloudModel: string
  claimWords: string[]
}

export type ApprovalWrites = { alertId: string; alert: LinkedAlert; ledgerId: string; entry: ApprovedEntry; copy: ActiveCopy }

/**
 * The three documents an approval writes together: the alert, its entry, and
 * the copy residents read (src/alerts/residentCopy.ts). The store adds who
 * approved it and the server's time (approvedBy and approvedAt on the alert,
 * by and at on the entry, updatedAt on the copy).
 */
export function approvalWrites(approval: Extract<Approval, { ok: true }>, ledgerId: string, trail: Trail): ApprovalWrites {
  const kept = trail.drafts.slice(-LEDGER_LIMITS.drafts)
  return {
    alertId: approval.id,
    alert: { ...approval.record, ledgerId },
    ledgerId,
    entry: {
      kind: 'approved',
      alertId: approval.id,
      ...approval.record,
      cloudModel: clip(trail.cloudModel, LEDGER_LIMITS.cloudModel),
      claimWords: trail.claimWords.slice(0, LEDGER_LIMITS.claimWords),
      drafts: kept.map(clipDraft),
      draftsOmitted: trail.drafts.length - kept.length,
    },
    copy: activeCopy(approval.record),
  }
}

function clipDraft(d: LedgerDraft): LedgerDraft {
  return {
    ...d,
    prompt: clip(d.prompt, LEDGER_LIMITS.prompt),
    text: clip(d.text, LEDGER_LIMITS.draftText),
    issues: d.issues.slice(0, LEDGER_LIMITS.issues).map(({ rule, message }) => ({ rule, message: clip(message, LEDGER_LIMITS.issueMessage) })),
    error: clip(d.error, LEDGER_LIMITS.error),
  }
}

const CUT = ' … (cut)'

/** The text, cut to fit max characters, saying so at the end. */
export function clip(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - CUT.length) + CUT
}

/**
 * The record of a withdrawal: which alert, the text that was withdrawn, the
 * approval it cancels and why. The reason stays here, never on the alert,
 * because residents will read alerts and the reason never passes the checker.
 */
export type WithdrawnEntry = {
  kind: 'withdrawn'
  alertId: string
  household: AlertRecord['household']
  area: string
  /** The alert's text as it was withdrawn. */
  text: string
  /** The ledger entry of the approval it withdraws; empty for an alert saved before the ledger. */
  approvalId: string
  /** The officer's reason, for the record. */
  reason: string
}

/** The withdrawal field the alert gets. The store adds by and at. */
export type AlertWithdrawal = { ledgerId: string }

export type WithdrawalWrites = {
  alertId: string
  withdrawal: AlertWithdrawal
  ledgerId: string
  entry: WithdrawnEntry
  /** The resident copy without its text, so residents stop seeing the alert. */
  copy: WithdrawnCopy
}

export type Withdrawal = ({ ok: true } & WithdrawalWrites) | { ok: false; reason: string }

/**
 * The writes that withdraw a saved alert, or why it can't be withdrawn: the
 * alert's withdrawal field, its entry, and the resident copy without its text.
 * The store adds who withdrew it and the server's time.
 */
export function withdrawalWrites(saved: SavedAlert, ledgerId: string, reason: string): Withdrawal {
  const why = reason.trim()
  if (saved.withdrawn) return { ok: false, reason: 'This alert is already withdrawn.' }
  if (why === '') return { ok: false, reason: 'Say why you are withdrawing it. The reason goes in the ledger.' }
  if (why.length > LEDGER_LIMITS.reason)
    return { ok: false, reason: `The reason is too long (at most ${LEDGER_LIMITS.reason} characters).` }
  return {
    ok: true,
    alertId: saved.id,
    withdrawal: { ledgerId },
    ledgerId,
    entry: {
      kind: 'withdrawn',
      alertId: saved.id,
      household: saved.household,
      area: saved.area,
      text: saved.text,
      approvalId: saved.ledgerId ?? '',
      reason: why,
    },
    copy: withdrawnCopy(saved),
  }
}

/** What every entry has, as the console shows it. */
type EntryMeta = {
  id: string
  /** The officer's user ID. */
  by: string
  /** The server's time, or the laptop's estimate while the entry waits to upload. */
  at: Date | undefined
  /** Saved on this laptop, not yet uploaded. */
  pending: boolean
}

/** An approval's entry as the console shows it. */
export type ApprovedLedgerEntry = EntryMeta & {
  kind: 'approved'
  alertId: string
  household: AlertRecord['household']
  area: string
  signal: number
  text: string
  source: AlertSource
  edited: boolean
  factSheet: AlertRecord['factSheet']
  cloudModel: string
  drafts: LedgerDraft[]
  draftsOmitted: number
}

/** A withdrawal's entry as the console shows it. */
export type WithdrawnLedgerEntry = EntryMeta & WithdrawnEntry

export type LedgerEntry = ApprovedLedgerEntry | WithdrawnLedgerEntry

/** Reads an entry's fields; undefined if the document isn't one this app wrote. */
export function readLedgerEntry(
  id: string,
  data: Record<string, unknown>,
  at: Date | undefined,
  pending: boolean,
): LedgerEntry | undefined {
  const { kind, alertId, household, area, text, by } = data
  if (typeof alertId !== 'string' || typeof area !== 'string' || typeof text !== 'string' || typeof by !== 'string') return undefined
  if (!HOUSEHOLDS.some((h) => h.id === household)) return undefined
  const common = { id, alertId, household: household as AlertRecord['household'], area, text, by, at, pending }
  if (kind === 'withdrawn') {
    const { approvalId, reason } = data
    if (typeof approvalId !== 'string' || typeof reason !== 'string') return undefined
    return { ...common, kind, approvalId, reason }
  }
  if (kind !== 'approved') return undefined
  const { signal, source, edited, factSheet, cloudModel, drafts, draftsOmitted } = data
  if (typeof signal !== 'number' || typeof edited !== 'boolean' || typeof cloudModel !== 'string') return undefined
  if (typeof draftsOmitted !== 'number' || !ALERT_SOURCES.includes(source as AlertSource)) return undefined
  if (!isFactSheet(factSheet) || !Array.isArray(drafts) || !drafts.every(isLedgerDraft)) return undefined
  return { ...common, kind, signal, source: source as AlertSource, edited, factSheet, cloudModel, drafts, draftsOmitted }
}

function isFactSheet(v: unknown): v is AlertRecord['factSheet'] {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Record<string, unknown>
  return (
    typeof s.stormName === 'string' &&
    Array.isArray(s.signals) &&
    typeof s.landfallTime === 'string' &&
    Array.isArray(s.evacuationCentres) &&
    typeof s.hotline === 'string' &&
    typeof s.bulletinText === 'string'
  )
}

const OUTCOMES: readonly string[] = ['passed', 'failed', 'error', 'stopped'] satisfies DraftOutcome[]
const ROUTES: readonly string[] = ['prefer_on_device', 'only_in_cloud'] satisfies Route[]
const DRAFT_SOURCES: readonly string[] = ['on_device', 'in_cloud', 'unknown'] satisfies DraftSource[]

function isLedgerDraft(v: unknown): v is LedgerDraft {
  if (typeof v !== 'object' || v === null) return false
  const d = v as Record<string, unknown>
  return (
    typeof d.round === 'number' &&
    ROUTES.includes(d.route as string) &&
    typeof d.retry === 'boolean' &&
    typeof d.area === 'string' &&
    DRAFT_SOURCES.includes(d.source as string) &&
    typeof d.prompt === 'string' &&
    typeof d.text === 'string' &&
    OUTCOMES.includes(d.outcome as string) &&
    Array.isArray(d.issues) &&
    d.issues.every((i: unknown) => typeof i === 'object' && i !== null && typeof (i as Record<string, unknown>).message === 'string') &&
    typeof d.error === 'string' &&
    typeof d.startedAtMs === 'number' &&
    (d.firstTextMs === null || typeof d.firstTextMs === 'number') &&
    typeof d.totalMs === 'number'
  )
}
