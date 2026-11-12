import { describe, expect, it } from 'vitest'
import { checkDraft } from '../checker'
import { SAMPLE_SHEET } from '../checker/fixtures/halimbawa'
import { CHECKER_CLAIM_WORDS } from '../config/defaults'
import { segments } from './segments'

describe('segments', () => {
  it('rebuilds the draft exactly, with each flagged word marked', () => {
    const draft = 'Severe winds at 7 PM. Go to [School Name].'
    const { issues } = checkDraft(draft, SAMPLE_SHEET, { claimWords: [...CHECKER_CLAIM_WORDS] })
    const parts = segments(draft, issues)
    expect(parts.map((p) => p.text).join('')).toBe(draft)
    expect(parts.filter((p) => p.issue).map((p) => p.text)).toEqual(['Severe', '7 PM', '[School Name]'])
  })

  it('keeps the first of two overlapping spans and ignores spans outside the text', () => {
    const parts = segments('abcdef', [
      { rule: 'figures', message: 'a', span: { start: 1, end: 4, text: 'bcd' } },
      { rule: 'places', message: 'b', span: { start: 2, end: 5, text: 'cde' } },
      { rule: 'plain', message: 'c', span: { start: 4, end: 99, text: 'x' } },
      { rule: 'missing', message: 'no span' },
    ])
    expect(parts).toEqual([
      { text: 'a' },
      { text: 'bcd', issue: expect.objectContaining({ message: 'a' }) },
      { text: 'ef' },
    ])
  })
})
