/**
 * The cloud translation of an approved English alert: the prompt, the JSON
 * answer and reading it back. The answer shapes the text; the checker
 * (rule 7) still judges it against the English, and an officer approves it.
 */
import { keptFacts, type FactSheet } from '../checker'
import type { Language } from './languages'

/** Plain JSON schema for the cloud model's answer: one field, so it can't add a preamble or notes. */
export const TRANSLATION_SCHEMA = {
  type: 'object',
  properties: {
    translation: {
      type: 'string',
      description: 'The whole alert in the target language, one sentence for each English sentence.',
    },
  },
  required: ['translation'],
} as const

/**
 * The prompt for one language. It names what must stay as written, taken from
 * the English alert by the checker's own code, so the model is told exactly
 * what rule 7 will compare.
 */
export function translationPrompt(english: string, sheet: FactSheet, language: Language): string {
  const { figures, places } = keptFacts(english, sheet)
  const kept = [...places, ...figures].map((k) => `"${k}"`).join(', ')
  return [
    `Translate this typhoon alert from English into ${language.promptName}, for residents to read on their phones.`,
    'Write one sentence for each English sentence, in plain everyday words.',
    ...(kept ? [`Keep these exactly as the English writes them, without translating them: ${kept}.`] : []),
    'Do not add anything the English alert does not say: no other numbers, places, times or dates, and no words about how strong, dangerous or safe the storm is.',
    'No emojis, no Markdown, no brackets.',
    '',
    'English alert:',
    english,
  ].join('\n')
}

/** Reads the model's answer: the translation field if it parses, otherwise the raw text for the checker to judge. */
export function readTranslation(raw: string): string {
  const trimmed = raw.trim()
  try {
    const value: unknown = JSON.parse(trimmed)
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const t = (value as Record<string, unknown>).translation
      if (typeof t === 'string' && t.trim() !== '') return t.replace(/\s+/g, ' ').trim()
    }
  } catch {
    // Not JSON: the raw text goes to the checker as it is, like a draft's.
  }
  return trimmed
}
