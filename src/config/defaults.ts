/**
 * The one place for tunable defaults. Remote Config overrides these at runtime
 * (Firebase console > Remote Config), so a change there needs no redeploy.
 * Keys match the Remote Config parameter names exactly.
 */
import type { TranslatedClaim } from '../checker'
import type { LanguageCode } from '../translation/languages'

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

// English words that back each kind of claim, shared by both languages.
const STRONG = ['strong', 'stronger', 'strongest', 'strengthen', 'strengthening', 'severe', 'extreme', 'intense',
  'powerful', 'violent', 'heavy', 'maximum', 'super typhoon', 'major']
const DANGER = ['danger', 'dangerous', 'threat', 'risk', 'hazard', 'hazardous', 'life-threatening', 'deadly', 'unsafe']
const DEADLY = ['deadly', 'life-threatening', 'fatal', 'death']
const DESTRUCTIVE = ['destructive', 'devastating', 'catastrophic', 'damage', 'damaging', 'destroy', 'destruction']
const SAFE = ['safe', 'safely', 'safety', 'no danger', 'no threat', 'not dangerous', 'all clear']
const WEAK = ['weak', 'weaker', 'weaken', 'weakened', 'weakening', 'minimal', 'minor']
const AUTHORITY = ['authorities', 'authority', 'officials', 'official', 'barangay captain', 'captain', 'tanod',
  'rescue teams', 'rescue team', 'emergency personnel', 'responders']
const STRONG_WINDS = ['strong winds', 'strong wind', 'destructive winds', 'maximum winds', 'maximum sustained winds']

/**
 * Claim words in Filipino and Cebuano (checker rule 7). A translation may use
 * one only when the approved English alert says one of its English words, so
 * "mapanganib" needs "dangerous" (or "danger", …) in the English. The same
 * kinds as the English list: severity, hazards, safety, timing and authority.
 * Written by hand for the demo, not by a model; a fluent speaker should review
 * them. A longer phrase is judged before a word inside it.
 */
export const TRANSLATION_CLAIMS: Readonly<Record<LanguageCode, readonly TranslatedClaim[]>> = {
  fil: [
    { words: ['malakas', 'napakalakas', 'pinakamalakas', 'lumalakas', 'lalakas', 'matindi', 'napakatindi', 'malubha', 'grabe', 'sobrang lakas'], english: STRONG },
    { words: ['super bagyo', 'superbagyo', 'super-bagyo'], english: ['super typhoon'] },
    { words: ['mapanganib', 'panganib', 'delikado', 'peligro', 'mapeligro'], english: DANGER },
    { words: ['nakamamatay', 'nakakamatay'], english: DEADLY },
    { words: ['mapaminsala', 'nakapipinsala', 'nakakapinsala', 'pinsala', 'mapanira', 'pagkawasak'], english: DESTRUCTIVE },
    { words: ['ligtas', 'kaligtasan', 'walang panganib', 'walang banta', 'walang dapat ikabahala', 'hindi delikado', 'hindi mapanganib'], english: SAFE },
    { words: ['mahina', 'humihina', 'hihina', 'humina'], english: WEAK },
    { words: ['ngayong gabi', 'mamayang gabi', 'ngayong gabing ito'], english: ['tonight', 'this evening'] },
    { words: ['ngayong araw', 'ngayong araw na ito'], english: ['today'] },
    { words: ['ngayong umaga', 'mamayang umaga', 'ngayong hapon', 'mamayang hapon'], english: ['this morning', 'this afternoon'] },
    { words: ['bukas', 'kinabukasan'], english: ['tomorrow', 'open'] },
    { words: ['hanggang sa susunod na abiso', 'hanggang may bagong abiso', 'hanggang sa may abiso'], english: ['until further notice'] },
    { words: ['baha', 'pagbaha', 'bumaha', 'babaha', 'binabaha', 'bahain'], english: ['flood', 'flooding', 'flash flood'] },
    { words: ['pagguho ng lupa', 'guho ng lupa', 'pagguho'], english: ['landslide', 'mudslide'] },
    { words: ['daluyong', 'daluyong ng bagyo'], english: ['storm surge', 'surge'] },
    { words: ['malakas na ulan', 'malakas na pag-ulan', 'buhos ng ulan', 'malakas na buhos ng ulan'], english: ['heavy rain', 'heavy rainfall', 'torrential rain'] },
    { words: ['malakas na hangin', 'malalakas na hangin', 'napakalakas na hangin'], english: STRONG_WINDS },
    { words: ['awtoridad', 'mga awtoridad', 'opisyal', 'mga opisyal', 'kapitan', 'kapitan ng barangay', 'tanod', 'rescuer', 'rescue team'], english: AUTHORITY },
  ],
  ceb: [
    { words: ['kusog', 'kusgan', 'kusog kaayo', 'pinakakusog', 'mokusog', 'grabe', 'grabeng', 'labihan', 'labihang'], english: STRONG },
    { words: ['super bagyo', 'superbagyo', 'super-bagyo'], english: ['super typhoon'] },
    { words: ['peligroso', 'delikado', 'kuyaw', 'makuyaw', 'peligro', 'kapeligrohan'], english: DANGER },
    { words: ['makamatay', 'ikamatay'], english: DEADLY },
    { words: ['makadaot', 'kadaot', 'makadaut', 'kadaut', 'makaguba'], english: DESTRUCTIVE },
    { words: ['luwas', 'kaluwasan', 'walay peligro', 'walay kapeligrohan', 'walay kuyaw', 'dili delikado', 'dili peligroso'], english: SAFE },
    { words: ['huyang', 'mohuyang', 'nihuyang', 'naghuyang'], english: WEAK },
    { words: ['karong gabii', 'karong gabhiona', 'unya sa gabii', 'unyang gabii'], english: ['tonight', 'this evening'] },
    { words: ['karong adlawa', 'karon nga adlaw', 'karong adlaw'], english: ['today'] },
    { words: ['karong buntag', 'karong buntaga', 'karong hapon', 'karong hapona', 'unya sa hapon', 'unyang hapon'], english: ['this morning', 'this afternoon'] },
    { words: ['ugma'], english: ['tomorrow'] },
    { words: ['hangtod sa sunod nga pahibalo', 'hangtod adunay bag-ong pahibalo'], english: ['until further notice'] },
    { words: ['baha', 'pagbaha', 'bahaan', 'mobaha', 'gibaha', 'lunop'], english: ['flood', 'flooding', 'flash flood'] },
    { words: ['pagdahili sa yuta', 'pagdahili', 'pagkahugno sa yuta'], english: ['landslide', 'mudslide'] },
    { words: ['daluyong', 'bul-og', 'bul-og sa dagat'], english: ['storm surge', 'surge'] },
    { words: ['kusog nga ulan', 'kusog nga pag-ulan', 'bunok sa ulan', 'kusog nga bunok'], english: ['heavy rain', 'heavy rainfall', 'torrential rain'] },
    { words: ['kusog nga hangin', 'kusog kaayo nga hangin', 'kusog nga huros'], english: STRONG_WINDS },
    { words: ['awtoridad', 'mga awtoridad', 'opisyal', 'mga opisyal', 'kapitan', 'tanod', 'rescuer', 'rescue team'], english: AUTHORITY },
  ],
}

/**
 * Phrases that tell a resident to do less than an alert says, for the answer
 * check (rule 8). Rule 5's words cover severity and safety; these cover an
 * answer that says "stay home" or "no need to evacuate" when the alert says
 * leave now. Allowed only when the alert itself says them. English, then
 * Filipino and Cebuano (written by hand for the demo; a fluent speaker should
 * review them). Plurals match automatically.
 */
export const ANSWER_CLAIM_WORDS: readonly string[] = [
  // English
  'stay home', 'stay at home', 'stay inside', 'stay indoors', 'stay put', 'shelter in place', 'no need',
  'not need', "don't need", "doesn't need", 'not necessary', 'unnecessary', 'not required', 'optional',
  'not evacuate', "don't evacuate", 'not leave', "don't leave", 'not go to', "don't go to", 'ignore', 'fake',
  'hoax', 'false alarm', 'cancelled', 'canceled', 'called off', 'is over', 'has passed', 'no typhoon',
  'no storm', 'wait and see', 'later',
  // Filipino
  'hindi kailangan', 'hindi na kailangan', 'di kailangan', 'huwag lumikas', 'huwag umalis', 'huwag pumunta',
  'manatili sa bahay', 'manatili sa loob', 'sa bahay lang', 'walang bagyo', 'kanselado', 'peke', 'mamaya na',
  // Cebuano
  'dili kinahanglan', 'di kinahanglan', 'ayaw pagbakwit', 'ayaw bakwit', 'ayaw mobiya', 'ayaw lakaw',
  'pabilin sa balay', 'puyo lang sa balay', 'sa balay lang', 'walay bagyo', 'unya na lang',
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
  /** JSON object of claim lists by language code; see TRANSLATION_CLAIMS. */
  checker_translation_claims: JSON.stringify(TRANSLATION_CLAIMS),
  /** JSON array of strings; see ANSWER_CLAIM_WORDS. */
  checker_answer_claims: JSON.stringify(ANSWER_CLAIM_WORDS),
  /**
   * Cloud answers to residents' questions per phone per hour. Residents sign
   * in anonymously, so this keeps one phone from using the free tier's quota
   * that officers need for drafts and translations. On-device answers and
   * text search are never limited.
   */
  ask_cloud_per_hour: 6,
} as const

export type RemoteConfigKey = keyof typeof REMOTE_CONFIG_DEFAULTS

/** How often the app may fetch new Remote Config values (Firebase's default is 12 hours). */
export const REMOTE_CONFIG_MIN_FETCH_INTERVAL_MS = 60 * 60 * 1000
