import { describe, expect, it } from 'vitest'
import { CHECKER_CLAIM_WORDS } from '../config/defaults'
import { checkDraft } from '../checker'
import { SAMPLE_SHEET } from '../checker/fixtures/halimbawa'
import { HOUSEHOLDS } from './households'
import { buildDraftPrompt, buildRetryPrompt } from './prompt'

const general = HOUSEHOLDS[0]

describe('buildDraftPrompt', () => {
  it('states each fact once, in the spelling the checker accepts', () => {
    expect(buildDraftPrompt(SAMPLE_SHEET, 'Purok Ilaya', general)).toBe(
      [
        'Write a typhoon alert for all residents in Purok Ilaya, Barangay Halimbawa.',
        'Use these facts exactly as written, and no other facts:',
        '- Storm: Typhoon Sample',
        '- Signal No. 3 in Purok Ilaya',
        '- Landfall: 6:00 PM on Nov 14',
        '- Evacuation centre: Halimbawa Elementary School gym or Barangay Hall',
        '- Hotline: 0917 555 0100',
        'Tell them to leave now.',
        'Say when as “6:00 PM on Nov 14”, with no other time words.',
        'Write at most 3 short sentences in plain English. No emojis, no Markdown, no brackets, no placeholders.',
        'Do not add any other numbers, places, times or dates, and do not describe how strong the storm is.',
      ].join('\n'),
    )
  })

  it('uses the signal of the chosen area', () => {
    expect(buildDraftPrompt(SAMPLE_SHEET, 'Purok 2', general)).toContain('- Signal No. 2 in Purok 2')
  })

  it('leaves out a hotline the bulletin does not have', () => {
    expect(buildDraftPrompt({ ...SAMPLE_SHEET, hotline: '' }, 'Purok 2', general)).not.toContain('Hotline')
  })

  it('gives no household advice that the checker would flag', () => {
    for (const h of HOUSEHOLDS) {
      const issues = checkDraft(h.advice, SAMPLE_SHEET, { claimWords: [...CHECKER_CLAIM_WORDS], required: [] }).issues
      expect(issues, h.id).toEqual([])
    }
  })
})

describe('buildRetryPrompt', () => {
  it('gives the failed draft back with one edit per problem, and no other facts', () => {
    const draft = ' Typhoon Sample hits Purok 1 at 6 PM tonight. '
    const { issues } = checkDraft(draft, SAMPLE_SHEET, { claimWords: [...CHECKER_CLAIM_WORDS], area: 'Purok 1', required: [] })
    expect(buildRetryPrompt(draft, issues, SAMPLE_SHEET, 'Purok 1')).toBe(
      [
        'Here is a typhoon alert:',
        'Typhoon Sample hits Purok 1 at 6 PM tonight.',
        '',
        'Rewrite it with these changes, and keep everything else the same:',
        '- Remove “tonight”; the bulletin doesn’t say it.',
        'Reply with only the new alert, in plain text.',
      ].join('\n'),
    )
  })
})
