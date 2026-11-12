/**
 * The one place for tunable defaults. Remote Config overrides these at runtime
 * (Firebase console > Remote Config), so a change there needs no redeploy.
 * Keys match the Remote Config parameter names exactly.
 */

/**
 * Words that need support from the bulletin before an alert may use them
 * (checker rule 5, "no added claims"): severity, hazards, safety, timing and
 * authority. Built from real Nano and cloud drafts on Nov 12. A word is allowed
 * when the bulletin itself uses it. Plurals match automatically.
 */
export const CHECKER_CLAIM_WORDS: readonly string[] = [
  // Severity
  'severe', 'super typhoon', 'extreme', 'catastrophic', 'destructive', 'devastating', 'deadly',
  'life-threatening', 'dangerous', 'violent', 'intense', 'powerful', 'major', 'imminent', 'worsen',
  'worsening',
  // Hazards
  'strong winds', 'destructive winds', 'heavy rain', 'heavy rainfall', 'torrential rain',
  'storm surge', 'flood', 'flooding', 'flash flood', 'landslide', 'tsunami',
  // Safety and reassurance
  'safe', 'no threat', 'no danger', 'not dangerous', 'all clear', 'minimal', 'minor', 'weak', 'weakening',
  // Timing not stated as a time
  'today', 'tonight', 'this evening', 'this morning', 'this afternoon', 'tomorrow', 'until further notice',
  // Authority and instructions not in the bulletin
  'authorities', 'emergency personnel', 'officials', 'rescue teams', 'evacuation routes',
  'barangay captain', 'tanod',
]

export const REMOTE_CONFIG_DEFAULTS = {
  /**
   * Cloud model for Firebase AI Logic. Gemini 3+ only, billing not required.
   * gemini-3.5-flash-lite: on Nov 12 gemini-3.8-flash returned 500 "high demand"
   * or timed out, while flash-lite answered in 1 to 5 s. Switch in Remote Config.
   */
  cloud_model_name: 'gemini-3.5-flash-lite',
  /** Seconds to wait for an on-device draft before offering the cloud. */
  ondevice_budget_seconds: 30,
  /** JSON array of strings; see CHECKER_CLAIM_WORDS. */
  checker_claim_words: JSON.stringify(CHECKER_CLAIM_WORDS),
} as const

export type RemoteConfigKey = keyof typeof REMOTE_CONFIG_DEFAULTS

/** How often the app may fetch new Remote Config values (Firebase's default is 12 hours). */
export const REMOTE_CONFIG_MIN_FETCH_INTERVAL_MS = 60 * 60 * 1000
