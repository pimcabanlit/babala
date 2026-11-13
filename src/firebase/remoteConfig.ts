import type { FirebaseApp } from 'firebase/app'
import { fetchAndActivate, getRemoteConfig, getValue } from 'firebase/remote-config'
import type { TranslatedClaim } from '../checker'
import {
  ANSWER_CLAIM_WORDS,
  CHECKER_CLAIM_WORDS,
  REMOTE_CONFIG_DEFAULTS,
  REMOTE_CONFIG_MIN_FETCH_INTERVAL_MS,
  TRANSLATION_CLAIMS,
  type RemoteConfigKey,
} from '../config/defaults'
import { LANGUAGE_CODES, type LanguageCode } from '../translation/languages'

export type TranslationClaims = Record<LanguageCode, TranslatedClaim[]>

export type Tunables = {
  cloudModelName: string
  ondeviceBudgetSeconds: number
  checkerClaimWords: string[]
  /** Filipino and Cebuano claim words for translations (checker rule 7). */
  translationClaims: TranslationClaims
  /** Phrases an answer to a resident may use only when the alert does (checker rule 8). */
  answerClaims: string[]
  /** Cloud answers to residents' questions per phone per hour. */
  askCloudPerHour: number
  /** Where each value came from: 'remote', 'default' or 'static'. */
  sources: Record<RemoteConfigKey, string>
}

/**
 * The tunables before Remote Config answers, or without Firebase: the
 * defaults from src/config/defaults.ts. The checker works by hand with these.
 */
export const DEFAULT_TUNABLES: Tunables = {
  cloudModelName: REMOTE_CONFIG_DEFAULTS.cloud_model_name,
  ondeviceBudgetSeconds: REMOTE_CONFIG_DEFAULTS.ondevice_budget_seconds,
  checkerClaimWords: [...CHECKER_CLAIM_WORDS],
  translationClaims: defaultTranslationClaims(),
  answerClaims: [...ANSWER_CLAIM_WORDS],
  askCloudPerHour: REMOTE_CONFIG_DEFAULTS.ask_cloud_per_hour,
  sources: {
    cloud_model_name: 'default',
    ondevice_budget_seconds: 'default',
    checker_claim_words: 'default',
    checker_translation_claims: 'default',
    checker_answer_claims: 'default',
    ask_cloud_per_hour: 'default',
  },
}

/**
 * Fetches Remote Config and returns the tunables. Offline or on error it keeps
 * the last fetched values, or the defaults in src/config/defaults.ts, so the
 * app always has working values.
 */
export async function loadTunables(app: FirebaseApp): Promise<Tunables> {
  const rc = getRemoteConfig(app)
  rc.settings.minimumFetchIntervalMillis = REMOTE_CONFIG_MIN_FETCH_INTERVAL_MS
  rc.defaultConfig = { ...REMOTE_CONFIG_DEFAULTS }
  try {
    await fetchAndActivate(rc)
  } catch (err) {
    console.warn('Remote Config fetch failed; using cached or default values.', err)
  }
  const model = getValue(rc, 'cloud_model_name')
  const budget = getValue(rc, 'ondevice_budget_seconds')
  const budgetSeconds = budget.asNumber()
  const claimWords = getValue(rc, 'checker_claim_words')
  const translationClaims = getValue(rc, 'checker_translation_claims')
  const answerClaims = getValue(rc, 'checker_answer_claims')
  const askPerHour = getValue(rc, 'ask_cloud_per_hour')
  return {
    cloudModelName: model.asString() || REMOTE_CONFIG_DEFAULTS.cloud_model_name,
    ondeviceBudgetSeconds:
      budgetSeconds > 0 ? budgetSeconds : REMOTE_CONFIG_DEFAULTS.ondevice_budget_seconds,
    checkerClaimWords: parseWordList(claimWords.asString()) ?? [...CHECKER_CLAIM_WORDS],
    translationClaims: parseTranslationClaims(translationClaims.asString()) ?? defaultTranslationClaims(),
    answerClaims: parseWordList(answerClaims.asString()) ?? [...ANSWER_CLAIM_WORDS],
    askCloudPerHour: readAskLimit(askPerHour.asString()),
    sources: {
      cloud_model_name: model.getSource(),
      ondevice_budget_seconds: budget.getSource(),
      checker_claim_words: claimWords.getSource(),
      checker_translation_claims: translationClaims.getSource(),
      checker_answer_claims: answerClaims.getSource(),
      ask_cloud_per_hour: askPerHour.getSource(),
    },
  }
}

/**
 * The per-phone limit on cloud answers: a whole number, 0 or more, where 0
 * turns cloud answers off. Anything else (empty, negative, a fraction, a
 * typo) uses the default, so a mistake in the console never turns them off.
 */
export function readAskLimit(value: string): number {
  const n = value.trim() === '' ? NaN : Number(value)
  return Number.isInteger(n) && n >= 0 ? n : REMOTE_CONFIG_DEFAULTS.ask_cloud_per_hour
}

/** A JSON array of non-empty strings, or undefined if the value isn't one. */
export function parseWordList(json: string): string[] | undefined {
  try {
    const value: unknown = JSON.parse(json)
    if (!Array.isArray(value)) return undefined
    const words = value.filter((w): w is string => typeof w === 'string' && w.trim() !== '')
    return words.length > 0 && words.length === value.length ? words : undefined
  } catch {
    return undefined
  }
}

/** A copy of the default Filipino and Cebuano claim lists. */
export function defaultTranslationClaims(): TranslationClaims {
  return {
    fil: TRANSLATION_CLAIMS.fil.map(copyClaim),
    ceb: TRANSLATION_CLAIMS.ceb.map(copyClaim),
  }
}

function copyClaim(c: TranslatedClaim): TranslatedClaim {
  return { words: [...c.words], english: [...c.english] }
}

/**
 * Claim lists for every language, as a JSON object such as
 * {"fil": [{"words": ["mapanganib"], "english": ["dangerous"]}], "ceb": [...]},
 * or undefined if the value isn't one. A language left out or an empty list
 * would let every claim in it through, so both are refused.
 */
export function parseTranslationClaims(json: string): TranslationClaims | undefined {
  try {
    const value: unknown = JSON.parse(json)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
    const byLanguage = value as Record<string, unknown>
    const out: Partial<TranslationClaims> = {}
    for (const code of LANGUAGE_CODES) {
      const list = byLanguage[code]
      if (!Array.isArray(list) || list.length === 0) return undefined
      const claims: TranslatedClaim[] = []
      for (const item of list) {
        if (typeof item !== 'object' || item === null) return undefined
        const { words, english } = item as Record<string, unknown>
        const w = parseList(words)
        const e = parseList(english)
        if (!w || !e) return undefined
        claims.push({ words: w, english: e })
      }
      out[code] = claims
    }
    return out as TranslationClaims
  } catch {
    return undefined
  }
}

/** A non-empty array of non-empty strings, or undefined. */
function parseList(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined
  return value.every((w) => typeof w === 'string' && w.trim() !== '') ? (value as string[]) : undefined
}
