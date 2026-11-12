/**
 * The one place for tunable defaults. Remote Config overrides these at runtime
 * (Firebase console > Remote Config), so a change there needs no redeploy.
 * Keys match the Remote Config parameter names exactly.
 */
export const REMOTE_CONFIG_DEFAULTS = {
  /** Cloud model for Firebase AI Logic. Gemini 3+ only, billing not required. */
  cloud_model_name: 'gemini-3.8-flash',
  /** Seconds to wait for an on-device draft before offering the cloud. */
  ondevice_budget_seconds: 30,
} as const

export type RemoteConfigKey = keyof typeof REMOTE_CONFIG_DEFAULTS

/** How often the app may fetch new Remote Config values (Firebase's default is 12 hours). */
export const REMOTE_CONFIG_MIN_FETCH_INTERVAL_MS = 60 * 60 * 1000
