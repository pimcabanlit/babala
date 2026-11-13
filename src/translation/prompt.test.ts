import { describe, expect, it } from 'vitest'
import { GOOD_DRAFT, SAMPLE_SHEET } from '../checker/fixtures/halimbawa'
import { LANGUAGES } from './languages'
import { readTranslation, translationPrompt } from './prompt'

const cebuano = LANGUAGES.find((l) => l.code === 'ceb')!

describe('translationPrompt', () => {
  it('names the language, so the model can’t mistake it for another Philippine language', () => {
    expect(translationPrompt(GOOD_DRAFT, SAMPLE_SHEET, cebuano)).toContain('into Cebuano (Bisaya, Binisaya)')
  })

  it('lists every place name and figure the checker will compare, as the English writes them', () => {
    expect(translationPrompt(GOOD_DRAFT, SAMPLE_SHEET, cebuano)).toContain(
      'Keep these exactly as the English writes them, without translating them: "Purok Ilaya", "Halimbawa Elementary School gym", "Signal No. 3", "6 PM", "Nov 14", "0917 555 0100".',
    )
  })

  it('ends with the English alert itself', () => {
    expect(translationPrompt(GOOD_DRAFT, SAMPLE_SHEET, cebuano).endsWith(`English alert:\n${GOOD_DRAFT}`)).toBe(true)
  })
})

describe('readTranslation', () => {
  it('reads the translation field of a JSON answer, on one line', () => {
    expect(readTranslation('{"translation": "Nakataas ang Signal No. 3.\\n Lumikas na."}')).toBe('Nakataas ang Signal No. 3. Lumikas na.')
  })

  it('gives the raw answer to the checker when it isn’t the JSON asked for', () => {
    expect(readTranslation(' Here is the translation: Lumikas na. ')).toBe('Here is the translation: Lumikas na.')
    expect(readTranslation('{"text": "Lumikas na."}')).toBe('{"text": "Lumikas na."}')
  })
})
