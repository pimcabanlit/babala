import { describe, expect, it } from 'vitest'
import { checkDraft, type Issue } from '../checker'
import { DAY1_CASES, DAY1_SHEET } from '../checker/fixtures/day1'
import { GOOD_DRAFT, SAMPLE_SHEET } from '../checker/fixtures/halimbawa'
import { CHECKER_CLAIM_WORDS } from '../config/defaults'
import { editsFor, fixFor, whenText } from './fixes'

const claimWords = [...CHECKER_CLAIM_WORDS]

function edits(draft: string, sheet = SAMPLE_SHEET, area = 'Purok 1', required?: ('signal' | 'time' | 'place' | 'hotline')[]) {
  const { issues } = checkDraft(draft, sheet, { claimWords, area, ...(required ? { required } : {}) })
  return editsFor(issues, sheet, area, draft)
}

describe('editsFor', () => {
  it('turns every problem into one concrete edit with the fact sheet value, in reading order', () => {
    const draft =
      'Typhoon Sample is a severe storm! Signal No. 4 is up for Purok 9 and landfall is at 7 PM tonight. ⚠️ **Evacuate** to the municipal Barangay Hall or [Evacuation Centre] and call 0917 555 0199.'
    expect(edits(draft)).toEqual([
      'Remove “severe”; the bulletin doesn’t say it.',
      'Change “Signal No. 4” to “Signal No. 3”.',
      'Remove “Purok 9”; this alert is for Purok 1.',
      'Change “7 PM” to “6:00 PM”.',
      'Remove “tonight”; the bulletin doesn’t say it.',
      'Remove the emoji “⚠️”.',
      'Write “Evacuate” as plain text, without * or # marks.',
      'Change “municipal Barangay Hall” to “Barangay Hall”.',
      'Replace “[Evacuation Centre]” with “Halimbawa Elementary School gym”.',
      'Change “0917 555 0199” to “0917 555 0100”.',
    ])
  })

  it('changes another area’s signal number instead of adding a second one', () => {
    expect(edits('Signal No. 2 for Purok 1, landfall at 6 PM on Nov 14. Go to Barangay Hall and call 0917 555 0100.')).toEqual([
      'Change “Signal No. 2” to “Signal No. 3”.',
    ])
  })

  it('leaves out a missing fact that another edit already puts back', () => {
    // "7 PM" → "6:00 PM" also fixes "missing the landfall time"; same for the signal and hotline.
    expect(edits('Signal No. 5 for Purok 1. Landfall at 7 PM. Go to Barangay Hall and call 0917 555 0199.')).toEqual([
      'Change “Signal No. 5” to “Signal No. 3”.',
      'Change “7 PM” to “6:00 PM”.',
      'Change “0917 555 0199” to “0917 555 0100”.',
    ])
  })

  it('adds missing facts at the end, after the in-text edits', () => {
    expect(edits('Typhoon Sample is coming, so please leave tonight.')).toEqual([
      'Remove “tonight”; the bulletin doesn’t say it.',
      'Add “Signal No. 3 in Purok 1”.',
      'Add when: “6:00 PM on Nov 14”.',
      'Add where to go: “Halimbawa Elementary School gym” or “Barangay Hall”.',
      'Add the hotline: “0917 555 0100”.',
    ])
  })

  it('fixes the real day-1 Nano draft with two placeholders in four of its seven edits', () => {
    const case6 = DAY1_CASES.find((c) => c.name.startsWith('case 6'))!.text
    expect(edits(case6, DAY1_SHEET, 'coastal village', ['signal', 'time', 'place'])).toEqual([
      'Replace “[Village Name]” with “coastal village”.',
      'Remove “severe”; the bulletin doesn’t say it.',
      'Remove “strong winds”; the bulletin doesn’t say it.',
      'Remove “heavy rain”; the bulletin doesn’t say it.',
      // The "gymnasium" right after the placeholder needs no edit of its own.
      'Replace “[School Name]” with “school gym”.',
      'Remove “emergency personnel”; the bulletin doesn’t say it.',
    ])
  })

  it('names a different centre for each place it replaces', () => {
    expect(edits('Signal No. 3 for Purok 1, landfall at 6 PM. Go to the municipal gym or [Evacuation Centre]. Call 0917 555 0100.')).toEqual([
      'Replace “municipal gym” with “Halimbawa Elementary School gym”.',
      'Replace “[Evacuation Centre]” with “Barangay Hall”.',
    ])
  })

  it('asks for nothing when the draft passes', () => {
    expect(edits(GOOD_DRAFT, SAMPLE_SHEET, 'Purok Ilaya')).toEqual([])
  })

  it('shortens a long draft and strips Markdown', () => {
    const long = 'Leave now. '.repeat(4) + 'Signal No. 3 for Purok 1, landfall at 6 PM on Nov 14; go to Barangay Hall or call 0917 555 0100.'
    expect(edits(long)).toEqual(['Use at most 3 sentences.'])
    expect(edits('## Alert\nSignal No. 3 for Purok 1, landfall at 6 PM on Nov 14. Go to Barangay Hall. Call 0917 555 0100.')).toEqual([
      'Remove “##” from the start of the line.',
    ])
  })
})

describe('fixFor', () => {
  const placeholder = (text: string): Issue => ({ rule: 'placeholders', message: '', span: { start: 0, end: text.length, text } })

  it('fills a placeholder with the fact its wording names, or removes it', () => {
    expect(fixFor(placeholder('[Hotline Number]'), SAMPLE_SHEET, 'Purok 1')).toBe('Replace “[Hotline Number]” with “0917 555 0100”.')
    expect(fixFor(placeholder('[Date]'), SAMPLE_SHEET, 'Purok 1')).toBe('Replace “[Date]” with “Nov 14”.')
    expect(fixFor(placeholder('[Barangay]'), SAMPLE_SHEET, 'Purok 1')).toBe('Replace “[Barangay]” with “Purok 1, Barangay Halimbawa”.')
    expect(fixFor(placeholder('TBD'), SAMPLE_SHEET, 'Purok 1')).toBe('Remove “TBD”.')
  })

  it('removes a wrong date or phone number when the fact sheet has none', () => {
    const sheet = { ...SAMPLE_SHEET, hotline: '', landfallDate: undefined }
    const { issues } = checkDraft('Call 0917 555 0199 on Nov 15.', sheet, { claimWords, required: [] })
    expect(issues.map((i) => fixFor(i, sheet, 'Purok 1'))).toEqual(['Remove “0917 555 0199”.', 'Remove “Nov 15”.'])
  })
})

describe('whenText', () => {
  it('gives the landfall time as drafts should write it', () => {
    expect(whenText(SAMPLE_SHEET)).toBe('6:00 PM on Nov 14')
    expect(whenText({ ...SAMPLE_SHEET, landfallDate: undefined })).toBe('6:00 PM')
  })
})
