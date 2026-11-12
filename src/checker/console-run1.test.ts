import { describe, expect, it } from 'vitest'
import { CHECKER_CLAIM_WORDS } from '../config/defaults'
import { checkDraft } from './check'
import { CONSOLE_RUN1 } from './fixtures/console-run1'
import { SAMPLE_SHEET } from './fixtures/halimbawa'
import type { RequiredFact } from './types'

const required: Record<string, RequiredFact[]> = {
  general: ['signal', 'time', 'place', 'hotline'],
  seniors: ['signal', 'time', 'place', 'hotline'],
  families: ['signal', 'time', 'place', 'hotline'],
  fishers: ['signal', 'time', 'hotline'],
}

/** Each problem as "rule:subject". */
const expected: Record<string, string[]> = {
  'general 1: Nano draft': ['missing:time', 'plain:sentences'],
  // The landfall time moved onto "declared": right figure, wrong fact.
  'general 2: Nano retry': ['figures:landfall', 'plain:sentences'],
  'general 3: cloud retry': ['figures:landfall'],
  'seniors 1: Nano draft': ['plain:sentences'],
  'seniors 2: Nano retry': [],
  'families 1: Nano draft': ['missing:time', 'missing:place', 'missing:hotline'],
  'families 2: Nano retry': ['figures:landfall', 'plain:sentences'],
  'families 3: cloud retry': ['figures:landfall'],
  'fishers 1: Nano draft': ['missing:time', 'plain:sentences'],
  'fishers 2: Nano retry': ['figures:landfall'],
}

describe('console run 1 (Nov 12, laptop): real Nano and cloud answers', () => {
  it.each(CONSOLE_RUN1)('$name', ({ name, household, text }) => {
    const { issues } = checkDraft(text, SAMPLE_SHEET, {
      claimWords: [...CHECKER_CLAIM_WORDS],
      area: 'Purok 1',
      required: required[household],
    })
    expect(issues.map((i) => `${i.rule}:${i.subject}`).sort()).toEqual([...expected[name]].sort())
  })
})
