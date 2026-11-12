/**
 * The ledger: a locked record of every change to a saved alert, in Firestore
 * at `ledger/{entryId}`. Today the only change is an approval. Withdrawals and
 * translations add their own kinds of entry later.
 *
 * An approval writes the alert and its entry in one batch, and firestore.rules
 * refuses either one without the other, so no alert is saved without its
 * record. Entries can't be changed or deleted, so a later approval replaces the
 * alert but never its history.
 *
 * Pure code, so the console and the rules tests build exactly the same
 * documents. firestore.rules checks the same fields and limits. Change both together.
 */
import type { Route } from '../ai'
import type { Rule } from '../checker'
import { ALERT_SOURCES, type AlertRecord, type AlertSource, type Approval } from '../alerts/record'
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

export type ApprovalWrites = { alertId: string; alert: LinkedAlert; ledgerId: string; entry: ApprovedEntry }

/**
 * The two documents an approval writes together. The store adds who approved
 * it and the server's time to both (approvedBy and approvedAt on the alert,
 * by and at on the entry).
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

/** A ledger entry as the console shows it. */
export type LedgerEntry = {
  id: string
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
  /** The officer's user ID. */
  by: string
  /** The server's time, or the laptop's estimate while the entry waits to upload. */
  at: Date | undefined
  /** Saved on this laptop, not yet uploaded. */
  pending: boolean
}

/** Reads an entry's fields; undefined if the document isn't one this app wrote. */
export function readLedgerEntry(
  id: string,
  data: Record<string, unknown>,
  at: Date | undefined,
  pending: boolean,
): LedgerEntry | undefined {
  const { kind, alertId, household, area, signal, text, source, edited, factSheet, cloudModel, drafts, draftsOmitted, by } = data
  if (kind !== 'approved') return undefined
  if (typeof alertId !== 'string' || typeof area !== 'string' || typeof text !== 'string' || typeof by !== 'string') return undefined
  if (!HOUSEHOLDS.some((h) => h.id === household)) return undefined
  if (typeof signal !== 'number' || typeof edited !== 'boolean' || typeof cloudModel !== 'string') return undefined
  if (typeof draftsOmitted !== 'number' || !ALERT_SOURCES.includes(source as AlertSource)) return undefined
  if (!isFactSheet(factSheet) || !Array.isArray(drafts) || !drafts.every(isLedgerDraft)) return undefined
  return {
    id,
    kind,
    alertId,
    household: household as AlertRecord['household'],
    area,
    signal,
    text,
    source: source as AlertSource,
    edited,
    factSheet,
    cloudModel,
    drafts,
    draftsOmitted,
    by,
    at,
    pending,
  }
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
