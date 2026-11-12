import { InferenceSource, type Source } from '../ai'
import type { AlertSource } from '../alerts/record'
import type { DraftOutcome, DraftSource, LedgerDraft } from '../ledger/record'
import { inReadingOrder } from './segments'
import type { Attempt, Draft } from './useDrafts'

/**
 * Which model wrote the draft's text: the last attempt that finished with
 * text. "none" when no model did, i.e. the officer typed the alert.
 */
export function writtenBy(draft: Draft): AlertSource {
  const last = draft.attempts.findLast((a) => a.endedMs !== undefined && !a.error && !a.abandoned && a.text.trim() !== '')
  if (!last) return 'none'
  return modelSource(last.source)
}

function modelSource(source: Source | undefined): DraftSource {
  if (source === InferenceSource.ON_DEVICE) return 'on_device'
  if (source === InferenceSource.IN_CLOUD) return 'in_cloud'
  return 'unknown'
}

/**
 * The model calls on the card that no ledger entry has yet, oldest first, for
 * the entry of the approval being saved, and the highest attempt id among
 * them (or the card's recordedThrough when there are none). Rounds are
 * numbered across the card, so "Draft again" shows as a new round.
 */
export function unrecordedDrafts(draft: Draft): { drafts: LedgerDraft[]; through: number } {
  const rounds = draft.attempts.length > 0 ? [...draft.history, draft.attempts] : draft.history
  const drafts: LedgerDraft[] = []
  let through = draft.recordedThrough
  rounds.forEach((round, i) => {
    for (const a of round) {
      // Still streaming: not a finished draft yet. Approve is off while a draft runs.
      if (a.id <= draft.recordedThrough || a.endedMs === undefined) continue
      drafts.push(ledgerDraft(a, i + 1))
      through = Math.max(through, a.id)
    }
  })
  return { drafts, through }
}

function ledgerDraft(a: Attempt, round: number): LedgerDraft {
  return {
    round,
    route: a.route,
    retry: a.retry,
    area: a.area,
    source: modelSource(a.source),
    prompt: a.prompt,
    text: a.text,
    outcome: outcomeOf(a),
    // In reading order, as the card lists them; the spans themselves aren't kept.
    issues: inReadingOrder(a.issues ?? []).map(({ rule, message }) => ({ rule, message })),
    error: a.error ?? '',
    startedAtMs: a.startedAt,
    firstTextMs: a.firstTextMs ?? null,
    totalMs: a.endedMs ?? 0,
  }
}

function outcomeOf(a: Attempt): DraftOutcome {
  if (a.abandoned) return 'stopped'
  if (a.error) return 'error'
  return a.passed ? 'passed' : 'failed'
}
