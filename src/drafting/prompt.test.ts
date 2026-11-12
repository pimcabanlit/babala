import { describe, expect, it } from 'vitest'
import { CHECKER_CLAIM_WORDS } from '../config/defaults'
import { checkDraft } from '../checker'
import { SAMPLE_SHEET } from '../checker/fixtures/halimbawa'
import { CONSOLE_RUN1 } from '../checker/fixtures/console-run1'
import { HOUSEHOLDS } from './households'
import { buildDraftPrompt, buildRetryPrompt, outline } from './prompt'

const general = HOUSEHOLDS[0]

const fishers = HOUSEHOLDS.find((h) => h.id === 'fishers')!

describe('buildDraftPrompt', () => {
  it('gives a numbered outline with each fact once, in the spelling the checker accepts', () => {
    expect(buildDraftPrompt(SAMPLE_SHEET, 'Purok Ilaya', general)).toBe(
      [
        'Write a typhoon alert for all residents in Purok Ilaya, Barangay Halimbawa, as these 3 sentences. You may reword them a little, but keep every name, number and time exactly as written:',
        '1. Signal No. 3 is raised in Purok Ilaya, and Typhoon Sample makes landfall at 6:00 PM on Nov 14.',
        '2. Leave now, and go to Halimbawa Elementary School gym or Barangay Hall.',
        '3. Call the hotline, 0917 555 0100, for help.',
        'Do not add other numbers, places, times or dates, and do not describe how strong the storm is. No emojis, no Markdown, no brackets.',
      ].join('\n'),
    )
  })

  it('uses the signal of the chosen area', () => {
    expect(buildDraftPrompt(SAMPLE_SHEET, 'Purok 2', general)).toContain('Signal No. 2 is raised in Purok 2')
  })

  it('asks for 2 sentences when the bulletin has no hotline', () => {
    const prompt = buildDraftPrompt({ ...SAMPLE_SHEET, hotline: '' }, 'Purok 2', general)
    expect(prompt).toContain('as these 2 sentences')
    expect(prompt).not.toContain('hotline')
  })

  it('gives no household advice that the checker would flag', () => {
    for (const h of HOUSEHOLDS) {
      const issues = checkDraft(h.advice, SAMPLE_SHEET, { claimWords: [...CHECKER_CLAIM_WORDS], required: [] }).issues
      expect(issues, h.id).toEqual([])
    }
  })

  it('the outline itself is a passing alert, for every household and area, so copying it word for word is safe', () => {
    for (const h of HOUSEHOLDS)
      for (const { area } of SAMPLE_SHEET.signals) {
        const alert = outline(SAMPLE_SHEET, area, h).join(' ')
        const { issues } = checkDraft(alert, SAMPLE_SHEET, { claimWords: [...CHECKER_CLAIM_WORDS], area, required: h.required })
        expect(issues, `${h.id}, ${area}: ${alert}`).toEqual([])
      }
  })
})

describe('buildRetryPrompt', () => {
  const check = (draft: string, required = general.required) =>
    checkDraft(draft, SAMPLE_SHEET, { claimWords: [...CHECKER_CLAIM_WORDS], area: 'Purok 1', required }).issues

  it('gives word-level problems back as an edit list', () => {
    const draft = ' Typhoon Sample makes landfall in Purok 1 at 6 PM tonight. '
    expect(buildRetryPrompt(draft, check(draft, []), SAMPLE_SHEET, 'Purok 1', general)).toBe(
      [
        'Here is a typhoon alert:',
        'Typhoon Sample makes landfall in Purok 1 at 6 PM tonight.',
        '',
        'Rewrite it with these changes, and keep everything else the same:',
        '- Remove “tonight”; the bulletin doesn’t say it.',
        'Reply with only the new alert, in plain text.',
      ].join('\n'),
    )
  })

  it('gives the outline when the shape is wrong, as in the real laptop retry for fishers', () => {
    const draft = CONSOLE_RUN1.find((c) => c.name === 'fishers 2: Nano retry')!.text
    expect(buildRetryPrompt(draft, check(draft, fishers.required), SAMPLE_SHEET, 'Purok 1', fishers)).toBe(
      [
        'Here is a typhoon alert:',
        draft,
        '',
        'Rewrite it as these 3 sentences, keeping every name, number and time exactly as written:',
        '1. Signal No. 3 is raised in Purok 1, and Typhoon Sample makes landfall at 6:00 PM on Nov 14.',
        '2. Do not go out to sea, tie up your boats, and go to Halimbawa Elementary School gym or Barangay Hall.',
        '3. Call the hotline, 0917 555 0100, for help.',
        'Reply with only the new alert, in plain text.',
      ].join('\n'),
    )
  })

  it('adds word-level edits after the outline', () => {
    const draft = 'Leave tonight. Go now. Pack food. Stay calm.'
    const prompt = buildRetryPrompt(draft, check(draft), SAMPLE_SHEET, 'Purok 1', general)
    expect(prompt).toContain('Rewrite it as these 3 sentences')
    expect(prompt).toContain('Also make these changes:\n- Remove “tonight”; the bulletin doesn’t say it.')
    expect(prompt).not.toContain('Use at most')
    expect(prompt).not.toContain('Add when')
  })
})
