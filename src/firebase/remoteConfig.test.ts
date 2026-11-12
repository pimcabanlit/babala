import { describe, expect, it } from 'vitest'
import { CHECKER_CLAIM_WORDS, REMOTE_CONFIG_DEFAULTS } from '../config/defaults'
import { parseWordList } from './remoteConfig'

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
