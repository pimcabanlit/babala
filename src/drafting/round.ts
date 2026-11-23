/**
 * One round of drafting for one household: the attempts that nextStep
 * (route.ts) asks for, each checked, until one passes, the officer takes over,
 * or the officer cancels. No React or Firebase here, so the round can be tested
 * with made-up attempts; useDrafts streams the real ones.
 */
import type { Route } from '../ai'
import type { Issue } from '../checker'
import type { AttemptOutcome, NextStep } from './route'

/** How one model call ended, as the round needs it. */
export type AttemptEnd = {
  attemptId: number
  text: string
  error?: string
  /** The officer moved on to the cloud after the on-device budget. */
  abandoned?: boolean
  /** The officer cancelled the round while this call ran. */
  cancelled?: boolean
}

export type RoundDeps = {
  /** Resolves when the on-device warm-up is done, so a draft doesn't start a second session mid warm-up. */
  warmUp: () => Promise<unknown>
  /** The next step after these outcomes, with the network and the device as they are now. */
  next: (outcomes: AttemptOutcome[]) => NextStep
  /** The first prompt, and the retry prompt that quotes a failed draft with an edit per problem. */
  prompt: () => string
  retryPrompt: (text: string, issues: Issue[]) => string
  /** Runs one model call. It must end as soon as `signal` aborts, with `cancelled` set. */
  attempt: (route: Route, prompt: string, retry: boolean) => Promise<AttemptEnd>
  check: (text: string) => { pass: boolean; issues: Issue[] }
  /** The checker's verdict on a finished attempt. */
  onChecked: (attemptId: number, passed: boolean, issues: Issue[] | undefined) => void
  /** The routing handed over to the officer, with why. */
  onManual: (reason: string) => void
  /** Aborted when the officer cancels the round. */
  signal: AbortSignal
}

export type RoundEnd = {
  cancelled: boolean
  /** The last full draft a model wrote this round, for hand editing; empty when there was none. */
  lastDrafted: string
}

/** Resolves when the signal aborts, at once if it already has. */
export function whenAborted(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }))
}

export async function runRound(deps: RoundDeps): Promise<RoundEnd> {
  const { signal } = deps
  // A failed warm-up is shown elsewhere; only wait for it here, and stop waiting on a cancel.
  await Promise.race([deps.warmUp().catch(() => undefined), whenAborted(signal)])

  const outcomes: AttemptOutcome[] = []
  let last: { text: string; issues: Issue[] } | undefined
  // Kept for hand editing even when a later attempt errs, is abandoned or is cancelled.
  let lastDrafted = ''
  for (;;) {
    const step = deps.next(outcomes)
    // A draft that passed as the officer cancelled still stands.
    if (step.kind === 'done') break
    if (signal.aborted) return { cancelled: true, lastDrafted }
    if (step.kind === 'manual') {
      deps.onManual(step.reason)
      break
    }
    // After an error or an abandoned attempt there is no draft to quote, so start fresh.
    const quoted = step.retry && last && last.text.trim() !== '' ? last : undefined
    const prompt = quoted ? deps.retryPrompt(quoted.text, quoted.issues) : deps.prompt()
    const attempt = await deps.attempt(step.route, prompt, quoted !== undefined)
    if (attempt.cancelled) return { cancelled: true, lastDrafted }
    const ok = !attempt.error && !attempt.abandoned
    const result = ok ? deps.check(attempt.text) : undefined
    last = result ? { text: attempt.text, issues: result.issues } : undefined
    if (ok && attempt.text.trim() !== '') lastDrafted = attempt.text
    const passed = result?.pass ?? false
    deps.onChecked(attempt.attemptId, passed, result?.issues)
    outcomes.push({ route: step.route, passed, ...(attempt.abandoned ? { abandoned: true } : {}) })
  }
  return { cancelled: false, lastDrafted }
}
