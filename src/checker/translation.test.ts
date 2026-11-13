/**
 * Rule 7: each translation is checked on its own against the approved English
 * alert and the fact sheet. Hand-written from the demo bulletin (fixtures/halimbawa.ts).
 */
import { describe, expect, it } from 'vitest'
import { CHECKER_CLAIM_WORDS, TRANSLATION_CLAIMS } from '../config/defaults'
import { checkTranslation, keptFacts } from './check'
import { GOOD_CEBUANO, GOOD_DRAFT, GOOD_FILIPINO, SAMPLE_SHEET } from './fixtures/halimbawa'
import type { TranslationOptions } from './types'

const FILIPINO: TranslationOptions = { claimWords: [...CHECKER_CLAIM_WORDS], translatedClaims: [...TRANSLATION_CLAIMS.fil] }
const CEBUANO: TranslationOptions = { claimWords: [...CHECKER_CLAIM_WORDS], translatedClaims: [...TRANSLATION_CLAIMS.ceb] }

const messages = (english: string, translation: string, options: TranslationOptions) =>
  checkTranslation(english, translation, SAMPLE_SHEET, options).issues.map((i) => i.message)

describe('checkTranslation: places', () => {
  it('passes a Cebuano translation that keeps every figure and name', () => {
    expect(checkTranslation(GOOD_DRAFT, GOOD_CEBUANO, SAMPLE_SHEET, CEBUANO)).toEqual({ pass: true, issues: [] })
  })

  it('flags a known place that the English alert does not name', () => {
    const translation = GOOD_FILIPINO.replace('School gym.', 'School gym o sa Barangay Hall.')
    expect(messages(GOOD_DRAFT, translation, FILIPINO)).toEqual(['“Barangay Hall” is in the translation but not in the English alert.'])
  })

  it('flags a Filipino word for a venue outside the fact sheet’s names', () => {
    const translation = GOOD_FILIPINO.replace('School gym.', 'School gym o sa simbahan.')
    expect(messages(GOOD_DRAFT, translation, FILIPINO)).toEqual(['“o sa simbahan” is not an evacuation centre in the fact sheet.'])
  })

  it('flags a purok that is not in the fact sheet, once', () => {
    const translation = GOOD_FILIPINO.replace('sa Purok Ilaya', 'sa Purok Ilaya at Purok 5')
    expect(messages(GOOD_DRAFT, translation, FILIPINO)).toEqual(['“Purok 5” is not a purok or barangay in the fact sheet.'])
  })

  it('reports a lost place once, though the English alert names it twice', () => {
    const english = GOOD_DRAFT.replace('For help,', 'Purok Ilaya residents, for help,')
    const translation = GOOD_FILIPINO.replace('sa Purok Ilaya', 'sa inyong purok')
    expect(messages(english, translation, FILIPINO)).toEqual(['The translation must keep the place name “Purok Ilaya” exactly.'])
  })
})

describe('checkTranslation: claims', () => {
  it('flags a Filipino claim that the English alert does not make', () => {
    const translation = GOOD_FILIPINO.replace('Inaasahang tatama ang bagyo', 'Inaasahang tatama ang mapanganib na bagyo')
    expect(messages(GOOD_DRAFT, translation, FILIPINO)).toEqual(['“mapanganib” (“danger”) is not in the English alert.'])
  })

  it('allows a Filipino claim that the English alert makes', () => {
    const english = GOOD_DRAFT.replace('Signal No. 3 is raised over Purok Ilaya.', 'Signal No. 3 is raised over Purok Ilaya, with storm surge possible.')
    const translation = GOOD_FILIPINO.replace('sa Purok Ilaya.', 'sa Purok Ilaya, at posible ang daluyong.')
    expect(checkTranslation(english, translation, SAMPLE_SHEET, FILIPINO)).toEqual({ pass: true, issues: [] })
  })

  it('judges a phrase before the word inside it: “walang panganib” is a safety claim', () => {
    const translation = GOOD_FILIPINO.replace('Para sa tulong,', 'Walang panganib sa evacuation center. Para sa tulong,')
    expect(messages(GOOD_DRAFT, translation, FILIPINO)).toEqual([
      '“Walang panganib” (“safe”) is not in the English alert.',
      '4 sentences; the limit is 3.',
    ])
  })

  it('flags an English claim word kept in the translation when the English alert lacks it', () => {
    const translation = GOOD_FILIPINO.replace('ang bagyo', 'ang super typhoon')
    expect(messages(GOOD_DRAFT, translation, FILIPINO)).toEqual(['“super typhoon” is not in the English alert.'])
  })

  it('flags a Cebuano timing word that the English alert does not say', () => {
    const translation = GOOD_CEBUANO.replace('busa bakwit na karon', 'busa bakwit karong gabii')
    expect(messages(GOOD_DRAFT, translation, CEBUANO)).toEqual(['“karong gabii” (“tonight”) is not in the English alert.'])
  })

  it('uses only the translation’s own language list: a Cebuano word passes the Filipino list', () => {
    const translation = GOOD_FILIPINO.replace('ang bagyo', 'ang kuyaw nga bagyo')
    expect(checkTranslation(GOOD_DRAFT, translation, SAMPLE_SHEET, FILIPINO).pass).toBe(true)
    expect(messages(GOOD_DRAFT, translation, CEBUANO)).toEqual(['“kuyaw” (“danger”) is not in the English alert.'])
  })
})

describe('checkTranslation: figures and length', () => {
  it('reads a Filipino month name as the same date', () => {
    const translation = GOOD_FILIPINO.replace('sa Nov 14', 'sa ika-14 ng Nobyembre')
    expect(checkTranslation(GOOD_DRAFT, translation, SAMPLE_SHEET, FILIPINO)).toEqual({ pass: true, issues: [] })
  })

  it('flags a translation that drops the hotline', () => {
    const translation = GOOD_FILIPINO.replace(' Para sa tulong, tumawag sa 0917 555 0100.', '')
    expect(messages(GOOD_DRAFT, translation, FILIPINO)).toEqual(['The translation lost “0917 555 0100” from the English alert.'])
  })

  it('flags a translation over the word limit', () => {
    const translation = GOOD_FILIPINO.replace('Para sa tulong,', `Para sa tulong${' at'.repeat(60)},`)
    expect(messages(GOOD_DRAFT, translation, FILIPINO)).toEqual(['95 words; the limit is 90.'])
  })
})

describe('keptFacts', () => {
  it('lists the English alert’s figures and place names as written there', () => {
    expect(keptFacts(GOOD_DRAFT, SAMPLE_SHEET)).toEqual({
      figures: ['Signal No. 3', '6 PM', 'Nov 14', '0917 555 0100'],
      places: ['Purok Ilaya', 'Halimbawa Elementary School gym'],
    })
  })
})
