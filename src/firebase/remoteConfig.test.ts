import { describe, expect, it } from 'vitest'
import { CHECKER_CLAIM_WORDS, REMOTE_CONFIG_DEFAULTS } from '../config/defaults'
import { defaultTranslationClaims, parseTranslationClaims, parseWordList } from './remoteConfig'

describe('parseWordList', () => {
  it('reads the default word list back exactly', () => {
    expect(parseWordList(REMOTE_CONFIG_DEFAULTS.checker_claim_words)).toEqual([...CHECKER_CLAIM_WORDS])
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
