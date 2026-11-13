/**
 * Answers one question: the AI routes in the plan's order, each answer
 * checked by code against the approved alert (checker rule 8), then the
 * no-AI text search if no AI answer passes. The model calls are passed in,
 * so this runs in tests without Firebase.
 */
import { checkAnswer, sentences, type AnswerAlert, type Issue, type TranslatedClaim } from '../checker'
import type { Language } from '../resident/pack'
import { askPrompt, readAskAnswer } from './prompt'
import type { AiRoute, AskPlan } from './route'
import { searchAlert, type SearchResult } from './search'

export type AskInput = {
  question: string
  /** The approved alert: its English, the text the resident reads, and the storm and area names. */
  alert: AnswerAlert
  language: Language
}

export type CheckWords = {
  claimWords: string[]
  answerClaims: string[]
  /** Filipino and Cebuano claim lists together: answers may mix languages. */
  translatedClaims: TranslatedClaim[]
}

export type AskDeps = {
  /** One model call. The on-device route can't be cancelled; the budget only stops the wait. */
  call: (route: AiRoute, prompt: string) => Promise<{ text: string; source: string | undefined }>
  /** How long to wait for the on-device model before moving on. */
  onDeviceBudgetMs: number
  /** Called as each route starts, for the progress line. */
  onRoute?: (route: AiRoute) => void
  /** Called before each cloud call, to count it against this phone's hourly limit. */
  onCloudCall?: () => void
}

/** What happened on one AI route, for the line under the answer. */
export type Try =
  | { route: AiRoute; outcome: 'error'; error: string }
  | { route: AiRoute; outcome: 'slow'; seconds: number }
  | { route: AiRoute; outcome: 'unreadable' }
  | { route: AiRoute; outcome: 'held'; issues: Issue[] }

export type AskOutcome =
  /** An AI answer that passed the check, with the alert sentences it rests on, quoted word for word. */
  | { kind: 'answer'; route: AiRoute; source: string | undefined; answer: string; quotes: string[]; tries: Try[] }
  /** The AI read the alert and found no answer to the question in it. */
  | { kind: 'not-in-alert'; route: AiRoute; source: string | undefined; tries: Try[] }
  /** The text search, after the AI routes failed or when none could run. */
  | { kind: 'search'; result: SearchResult; tries: Try[]; reason?: string }

const SLOW = Symbol('slow')

/** Waits for the call, or gives up on waiting after `ms`. */
function within<T>(promise: Promise<T>, ms: number): Promise<T | typeof SLOW> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<typeof SLOW>((resolve) => {
    timer = setTimeout(() => resolve(SLOW), ms)
  })
  return Promise.race([promise, late]).finally(() => clearTimeout(timer))
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))

export async function answerQuestion(input: AskInput, plan: AskPlan, words: CheckWords, deps: AskDeps): Promise<AskOutcome> {
  const lines = sentences(input.alert.shown).map((s) => s.text)
  const prompt = askPrompt(lines, input.question, input.language)
  const tries: Try[] = []

  for (const route of plan.tries) {
    deps.onRoute?.(route)
    if (route === 'cloud') deps.onCloudCall?.()
    const startedAt = Date.now()
    let reply: { text: string; source: string | undefined } | typeof SLOW
    try {
      const call = deps.call(route, prompt)
      if (route === 'on_device') {
        // The SDK can't cancel an on-device call, so a late answer is dropped, and its error with it.
        call.catch(() => undefined)
        reply = await within(call, deps.onDeviceBudgetMs)
      } else reply = await call
    } catch (err) {
      tries.push({ route, outcome: 'error', error: errorText(err) })
      continue
    }
    if (reply === SLOW) {
      tries.push({ route, outcome: 'slow', seconds: Math.round((Date.now() - startedAt) / 1000) })
      continue
    }
    const read = readAskAnswer(reply.text, lines.length)
    if (!read) {
      tries.push({ route, outcome: 'unreadable' })
      continue
    }
    if (!read.inAlert) return { kind: 'not-in-alert', route, source: reply.source, tries }
    const check = checkAnswer(read.answer, input.alert, { language: input.language, ...words })
    if (!check.pass) {
      tries.push({ route, outcome: 'held', issues: check.issues })
      continue
    }
    const cited = read.sentences.map((n) => lines[n - 1])
    const search = searchAlert(input.alert.shown, input.question)
    const quotes = cited.length > 0 ? cited : search.found ? search.sentences : lines
    return { kind: 'answer', route, source: reply.source, answer: read.answer, quotes, tries }
  }

  return { kind: 'search', result: searchAlert(input.alert.shown, input.question), tries, reason: plan.searchOnly }
}
