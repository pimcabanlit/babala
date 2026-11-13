/**
 * Which routes answer a resident's question, in order (docs/architecture.md,
 * "Routing"): on the device if the model is ready and can write the
 * language, then the cloud if online and this phone has cloud answers left,
 * then the no-AI text search, which always runs. At most one call per route,
 * so at most two AI calls per question, and never two cloud calls.
 */
import type { Language } from '../resident/pack'

export type AiRoute = 'on_device' | 'cloud'

export type AskContext = {
  /** The language the resident reads the alert in, and the answer's language. */
  language: Language
  /** The question looks Filipino or Cebuano (looksLocal). */
  localQuestion: boolean
  /** Chrome reports the on-device model downloaded and ready. Never downloaded from the resident view. */
  deviceReady: boolean
  /** Firebase is configured in this copy of the app. */
  configured: boolean
  online: boolean
  /** Cloud answers this phone has left this hour. */
  cloudLeft: number
}

export type AskPlan = {
  /** The AI routes to try, in order. The text search comes after them. */
  tries: AiRoute[]
  /** Why the question goes straight to the text search, when no AI route can run. */
  searchOnly?: string
}

/**
 * Gemini Nano writes only English here (and de, es, fr, ja, which residents
 * don't read), and its input is declared as English, so it answers only in
 * English, and only questions that don't look Filipino or Cebuano.
 */
export function planAsk(ctx: AskContext): AskPlan {
  const onDevice = ctx.configured && ctx.deviceReady && ctx.language === 'en' && !ctx.localQuestion
  const cloud = ctx.configured && ctx.online && ctx.cloudLeft > 0
  const tries: AiRoute[] = [...(onDevice ? (['on_device'] as const) : []), ...(cloud ? (['cloud'] as const) : [])]
  if (tries.length > 0) return { tries }
  return { tries, searchOnly: searchOnlyReason(ctx) }
}

function searchOnlyReason(ctx: AskContext): string {
  if (!ctx.configured) return 'This copy of the app has no AI settings, so the answer comes from the saved alert.'
  if (!ctx.online) return 'Offline, so the answer comes from the alert saved on this phone, without AI.'
  return 'This phone has used its AI answers in the cloud for this hour, so the answer comes from the saved alert.'
}

/**
 * Words that mark a question as Filipino or Cebuano. English questions almost
 * never have them; "saan", "asa" and "ang" alone are enough.
 */
const LOCAL_WORDS = new Set([
  'saan', 'ano', 'anong', 'kailan', 'paano', 'bakit', 'sino', 'pwede', 'puwede', 'ba', 'po', 'kami', 'namin',
  'tayo', 'natin', 'ang', 'mga', 'ng', 'sa', 'nga', 'og', 'ug', 'asa', 'unsa', 'unsang', 'kanus-a', 'unsaon',
  'ngano', 'kinsa', 'mi', 'naa', 'wala', 'dili', 'hindi', 'kailangan', 'kinahanglan', 'lumikas', 'bakwit',
  'pupunta', 'moadto', 'dalhin', 'magdala', 'dad-a', 'tawag', 'oras', 'gabi', 'gabii', 'bahay', 'balay',
])

export function looksLocal(question: string): boolean {
  return [...question.toLowerCase().matchAll(/[\p{L}]+(?:-[\p{L}]+)*/gu)].some((m) => LOCAL_WORDS.has(m[0]))
}

const HOUR_MS = 60 * 60 * 1000

/** The cloud calls this phone made in the last hour, oldest first. */
export function recentCloudCalls(times: number[], now: number): number[] {
  return times.filter((t) => t <= now && now - t < HOUR_MS).sort((a, b) => a - b)
}

/** Cloud answers left this hour, and when the next one frees up if none are left. */
export function cloudAllowance(times: number[], now: number, perHour: number): { left: number; nextAtMs?: number } {
  const recent = recentCloudCalls(times, now)
  const left = Math.max(0, perHour - recent.length)
  if (left > 0 || perHour <= 0) return { left }
  return { left, nextAtMs: recent[recent.length - perHour] + HOUR_MS }
}

/** The saved list of cloud call times; an unreadable one is the same as none. */
export function cloudCallsFromJson(json: string | null): number[] {
  if (json === null) return []
  try {
    const value: unknown = JSON.parse(json)
    return Array.isArray(value) ? value.filter((t): t is number => typeof t === 'number' && Number.isFinite(t)) : []
  } catch {
    // A broken save only forgets earlier calls; the hour limit starts afresh.
    return []
  }
}
