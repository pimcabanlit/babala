import { describe, expect, it } from 'vitest'
import { ANSWER_CLAIM_WORDS, CHECKER_CLAIM_WORDS, REMOTE_CONFIG_DEFAULTS } from '../config/defaults'
import { defaultTranslationClaims, parseTranslationClaims, parseWordList, readAskLimit } from './remoteConfig'

describe('parseWordList', () => {
  it('reads the default word list back exactly', () => {
    expect(parseWordList(REMOTE_CONFIG_DEFAULTS.checker_claim_words)).toEqual([...CHECKER_CLAIM_WORDS])
  })

  it('reads the default answer claim list back exactly', () => {
    expect(parseWordList(REMOTE_CONFIG_DEFAULTS.checker_answer_claims)).toEqual([...ANSWER_CLAIM_WORDS])
  })

  it('accepts a JSON array of words, as typed in the Remote Config console', () => {
    expect(parseWordList('["severe", "storm surge"]')).toEqual(['severe', 'storm surge'])
  })

  it('rejects anything else, so the checker falls back to the defaults', () => {
    for (const bad of ['', 'severe, storm surge', '{}', '"severe"', '[]', '["severe", 3]', '["severe", " "]', '[']) {
      expect(parseWordList(bad), bad).toBeUndefined()
    }
  })
})

describe('parseTranslationClaims', () => {
  it('reads the default Filipino and Cebuano lists back exactly', () => {
    expect(parseTranslationClaims(REMOTE_CONFIG_DEFAULTS.checker_translation_claims)).toEqual(defaultTranslationClaims())
  })

  it('accepts a list per language, as typed in the Remote Config console', () => {
    const json = '{"fil": [{"words": ["mapanganib"], "english": ["dangerous"]}], "ceb": [{"words": ["kuyaw"], "english": ["dangerous"]}]}'
    expect(parseTranslationClaims(json)).toEqual({
      fil: [{ words: ['mapanganib'], english: ['dangerous'] }],
      ceb: [{ words: ['kuyaw'], english: ['dangerous'] }],
    })
  })

  it('rejects a missing language, an empty list or a malformed claim, so the checker falls back to the defaults', () => {
    const claim = '{"words": ["kuyaw"], "english": ["dangerous"]}'
    for (const bad of [
      '',
      '[]',
      `{"fil": [${claim}]}`,
      `{"fil": [], "ceb": [${claim}]}`,
      `{"fil": [{"words": [], "english": ["dangerous"]}], "ceb": [${claim}]}`,
      `{"fil": [{"words": ["kuyaw"], "english": [" "]}], "ceb": [${claim}]}`,
      `{"fil": [{"words": ["kuyaw"]}], "ceb": [${claim}]}`,
      `{"fil": ["kuyaw"], "ceb": [${claim}]}`,
    ]) {
      expect(parseTranslationClaims(bad), bad).toBeUndefined()
    }
  })
})

describe('readAskLimit', () => {
  it('accepts a whole number, and 0 turns cloud answers off', () => {
    expect(readAskLimit('10')).toBe(10)
    expect(readAskLimit('0')).toBe(0)
  })

  it('uses the default for anything else, so a typo never turns cloud answers off', () => {
    for (const bad of ['', ' ', '-1', '2.5', 'six', '6 per hour'])
      expect(readAskLimit(bad), bad).toBe(REMOTE_CONFIG_DEFAULTS.ask_cloud_per_hour)
  })
})
