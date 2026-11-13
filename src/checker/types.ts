/**
 * The checker's inputs and outputs. Plain data only: the checker never
 * imports Firebase, UI code or src/ai (CLAUDE.md, architecture rules).
 */

/** The confirmed facts from a bulletin, as the officer approved them. */
export type FactSheet = {
  stormName: string
  /** Signal number per area. */
  signals: { area: string; signal: number }[]
  /** Landfall time in 24-hour "HH:MM". */
  landfallTime: string
  /** Optional date, e.g. "Nov 14". Compared as month and day. */
  landfallDate?: string
  /** Evacuation centre names, written as residents would read them. */
  evacuationCentres: string[]
  /** Puroks (e.g. "Purok 2", "Purok Ilaya") and barangays covered. */
  puroks: string[]
  barangays: string[]
  /** The hotline as written in the bulletin. */
  hotline: string
  /** Any other figures the bulletin states (e.g. 185 for "185 km/h"). */
  otherFigures?: number[]
  /** The bulletin text. Claim words are allowed only if they appear here. */
  bulletinText: string
}

export type Rule =
  | 'figures'
  | 'places'
  | 'missing'
  | 'placeholders'
  | 'added-claims'
  | 'plain'
  | 'translation'

/** Where in the draft an issue is, so the console can highlight it. */
export type Span = { start: number; end: number; text: string }

/**
 * What exactly an issue is about, within its rule, so a retry prompt can say
 * how to fix it: the kind of figure, the missing fact, the kind of place, or
 * the style problem.
 */
export type IssueSubject =
  | 'time'
  | 'landfall'
  | 'date'
  | 'signal'
  | 'phone'
  | 'number'
  | 'place'
  | 'hotline'
  | 'venue'
  | 'area'
  | 'modifier'
  | 'sentences'
  | 'words'
  | 'emoji'
  | 'format'
  | 'script'

export type Issue = { rule: Rule; message: string; span?: Span; subject?: IssueSubject }

export type CheckResult = { pass: boolean; issues: Issue[] }

export type RequiredFact = 'signal' | 'time' | 'place' | 'hotline'

export type CheckOptions = {
  /** Facts this household type's alert must include. Default: all four. */
  required?: RequiredFact[]
  /** The area this alert is for; its signal number is the required one. */
  area?: string
  /** Severity, safety, timing and authority words that need bulletin support. */
  claimWords: string[]
  maxSentences?: number
  maxWords?: number
}

/**
 * A claim word in another language, and the English words that back it. A
 * translation may use one of `words` only when the approved English alert
 * says one of `english`: "mapanganib" needs "dangerous" (or "danger", …).
 */
export type TranslatedClaim = { words: string[]; english: string[] }

export type TranslationOptions = {
  /** The rule 5 word list: an English claim word in a translation must be in the English alert too. */
  claimWords: string[]
  /** Claim words in the translation's language, each with the English words that back it. */
  translatedClaims: TranslatedClaim[]
  maxSentences?: number
  maxWords?: number
}
