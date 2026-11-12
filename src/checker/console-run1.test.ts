import { describe, expect, it } from 'vitest'
import { CHECKER_CLAIM_WORDS } from '../config/defaults'
import { checkDraft } from './check'
import { CONSOLE_RUN1, CONSOLE_RUN2, CONSOLE_RUN3, CONSOLE_RUN4 } from './fixtures/console-run1'
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

const expected2: Record<string, string[]> = {
  'general 1: Nano draft': ['missing:time'],
  'general 2: Nano retry': [],
  'seniors 1: Nano draft': ['missing:time', 'plain:words'],
  'seniors 2: Nano retry': ['missing:time'],
  // The cloud copied the prompt's outline, "Tell them to…" and all.
  'seniors 3: cloud retry': ['placeholders:undefined', 'placeholders:undefined'],
  // "in effect landing at 6:00 PM" ties the time to the signal, not to landfall.
  'families 1: Nano draft': ['figures:landfall', 'plain:words'],
  'families 2: Nano retry': [],
  'fishers 1: Nano draft': [],
}

describe('console run 2 (Nov 12, laptop, outline prompts): real Nano and cloud answers', () => {
  it.each(CONSOLE_RUN2)('$name', ({ name, household, text }) => {
    const { issues } = checkDraft(text, SAMPLE_SHEET, {
      claimWords: [...CHECKER_CLAIM_WORDS],
      area: 'Purok 1',
      required: required[household],
    })
    expect(issues.map((i) => `${i.rule}:${i.subject}`).sort()).toEqual([...expected2[name]].sort())
  })
})

const expected3: Record<string, string[]> = {
  'general 1: Nano draft': ['plain:sentences'],
  'general 2: Nano retry': [],
  'seniors 1: Nano draft': ['places:venue', 'plain:sentences', 'plain:words'],
  // The list markers are formatting, reported once each, not also as the numbers 1 and 3.
  'seniors 2: Nano retry': ['plain:format', 'plain:format', 'plain:format'],
  'seniors 3: cloud retry': ['figures:phone', 'missing:hotline'],
  'families 1: Nano draft': ['plain:sentences', 'plain:words'],
  'families 2: Nano retry': ['plain:sentences'],
  'families 3: cloud retry': [],
  'fishers 1: Nano draft': ['plain:sentences'],
  'fishers 2: Nano retry': [],
}

describe('console run 3 (Nov 12, laptop, outline as the alert): real Nano and cloud answers', () => {
  it.each(CONSOLE_RUN3)('$name', ({ name, household, text }) => {
    const { issues } = checkDraft(text, SAMPLE_SHEET, {
      claimWords: [...CHECKER_CLAIM_WORDS],
      area: 'Purok 1',
      required: required[household],
    })
    expect(issues.map((i) => `${i.rule}:${i.subject}`).sort()).toEqual([...expected3[name]].sort())
  })
})

const expected4: Record<string, string[]> = {
  'general 1: Nano draft': [],
  // "reach the area" is not landfall: the bulletin's time is for landfall only.
  'seniors 1: Nano draft': ['figures:landfall'],
  'seniors 3: cloud retry': [],
  'families 1: Nano draft': [],
  'fishers 1: Nano draft': [],
}

describe('console run 4 (Nov 12, laptop, JSON fields): real Nano and cloud answers', () => {
  it.each(CONSOLE_RUN4)('$name', ({ name, household, text }) => {
    const { issues } = checkDraft(text, SAMPLE_SHEET, {
      claimWords: [...CHECKER_CLAIM_WORDS],
      area: 'Purok 1',
      required: required[household],
    })
    expect(issues.map((i) => `${i.rule}:${i.subject}`).sort()).toEqual([...expected4[name]].sort())
  })
})
