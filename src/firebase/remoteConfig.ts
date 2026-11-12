import type { FirebaseApp } from 'firebase/app'
import { fetchAndActivate, getRemoteConfig, getValue } from 'firebase/remote-config'
import {
  CHECKER_CLAIM_WORDS,
  REMOTE_CONFIG_DEFAULTS,
  REMOTE_CONFIG_MIN_FETCH_INTERVAL_MS,
  type RemoteConfigKey,
} from '../config/defaults'

export type Tunables = {
  cloudModelName: string
  ondeviceBudgetSeconds: number
  checkerClaimWords: string[]
  /** Where each value came from: 'remote', 'default' or 'static'. */
  sources: Record<RemoteConfigKey, string>
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
  return {
    cloudModelName: model.asString() || REMOTE_CONFIG_DEFAULTS.cloud_model_name,
    ondeviceBudgetSeconds:
      budgetSeconds > 0 ? budgetSeconds : REMOTE_CONFIG_DEFAULTS.ondevice_budget_seconds,
    checkerClaimWords: parseWordList(claimWords.asString()) ?? [...CHECKER_CLAIM_WORDS],
    sources: {
      cloud_model_name: model.getSource(),
      ondevice_budget_seconds: budget.getSource(),
      checker_claim_words: claimWords.getSource(),
    },
  }
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
