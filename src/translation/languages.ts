/**
 * The languages an approved English alert is translated into. Gemini Nano on
 * the laptop writes only de, en, es, fr and ja, so translations always run in
 * the cloud. English stays the alert of record: each translation is checked
 * against it on its own (checker rule 7).
 */

/** ISO 639 codes: "fil" for Filipino, "ceb" for Cebuano. */
export type LanguageCode = 'fil' | 'ceb'

export type Language = {
  code: LanguageCode
  /** What the console and the resident view call it. */
  label: string
  /** What the prompt calls it, so the model can't mistake Filipino for another Philippine language. */
  promptName: string
}

export const LANGUAGES: readonly Language[] = [
  { code: 'fil', label: 'Filipino', promptName: 'Filipino (Tagalog)' },
  { code: 'ceb', label: 'Cebuano (Bisaya)', promptName: 'Cebuano (Bisaya, Binisaya)' },
]

export const LANGUAGE_CODES: readonly LanguageCode[] = LANGUAGES.map((l) => l.code)

export function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGE_CODES.includes(value as LanguageCode)
}

export function languageLabel(code: LanguageCode): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code
}
