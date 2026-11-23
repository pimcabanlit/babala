import { describe, expect, it } from 'vitest'
import { checkDraft, type Issue } from '../checker'
import { DAY1_CASES, DAY1_SHEET } from '../checker/fixtures/day1'
import { GOOD_DRAFT, NANO_HINDI_DRAFT, SAMPLE_SHEET } from '../checker/fixtures/hillcrest'
import { CHECKER_CLAIM_WORDS } from '../config/defaults'
import { around, editsFor, fixFor, landfallPhrase, whenText } from './fixes'

const claimWords = [...CHECKER_CLAIM_WORDS]

function edits(draft: string, sheet = SAMPLE_SHEET, area = 'Zone 1', required?: ('signal' | 'time' | 'place' | 'hotline')[]) {
  const { issues } = checkDraft(draft, sheet, { claimWords, area, ...(required ? { required } : {}) })
  return editsFor(issues, sheet, area, draft)
}

describe('editsFor', () => {
  it('turns every problem into one concrete edit with the fact sheet value, in reading order', () => {
    const draft =
      'Typhoon Katy is a severe storm! Signal No. 4 is up for Zone 9 and landfall is at 7 PM tonight. ⚠️ **Evacuate** to the municipal Village Hall or [Evacuation Centre] and call 0917 555 0199.'
    expect(edits(draft)).toEqual([
      'Remove “severe”; the bulletin doesn’t say it.',
      'Change “Signal No. 4” to “Signal No. 3”.',
      // The draft doesn't name Zone 1, so removing Zone 9 would leave it with no area.
      'Change “Zone 9” to “Zone 1”.',
      'Change “7 PM” to “6:00 PM”.',
      'Remove “tonight”; the bulletin doesn’t say it.',
      'Remove the emoji “⚠️”.',
      'Write “Evacuate” as plain text, without * or # marks.',
      'Change “municipal Village Hall” to “Village Hall”.',
      'Replace “[Evacuation Centre]” with “Hillcrest Elementary School gym”.',
      'Change “0917 555 0199” to “0917 555 0100”.',
    ])
  })

  it('swaps another zone for the alert’s own, without also adding it', () => {
    // GOOD_DRAFT is written for Zone 2, which shares Signal No. 3 with Zone 1.
    expect(edits(GOOD_DRAFT)).toEqual(['Change “Zone 2” to “Zone 1”.'])
  })

  it('adds the area when the draft names none', () => {
    expect(edits('Signal No. 3 is raised. Landfall at 6 PM on Nov 14. Go to Village Hall and call 0917 555 0100.')).toEqual([
      'Add the area: “Zone 1”.',
    ])
  })

  it('changes another area’s signal number instead of adding a second one', () => {
    expect(edits('Signal No. 2 for Zone 1, landfall at 6 PM on Nov 14. Go to Village Hall and call 0917 555 0100.')).toEqual([
      'Change “Signal No. 2” to “Signal No. 3”.',
    ])
  })

  it('leaves out a missing fact that another edit already puts back', () => {
    // "7 PM" → "6:00 PM" also fixes "missing the landfall time"; same for the signal and hotline.
    expect(edits('Signal No. 5 for Zone 1. Landfall at 7 PM. Go to Village Hall and call 0917 555 0199.')).toEqual([
      'Change “Signal No. 5” to “Signal No. 3”.',
      'Change “7 PM” to “6:00 PM”.',
      'Change “0917 555 0199” to “0917 555 0100”.',
    ])
  })

  it('adds missing facts at the end, after the in-text edits', () => {
    expect(edits('Typhoon Katy is coming, so please leave tonight.')).toEqual([
      'Remove “tonight”; the bulletin doesn’t say it.',
      'Add “Signal No. 3 in Zone 1”.',
      'Add when: “6:00 PM on Nov 14”.',
      'Add where to go: “Hillcrest Elementary School gym” or “Village Hall”.',
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
    expect(edits('Signal No. 3 for Zone 1, landfall at 6 PM. Go to the municipal gym or [Evacuation Centre]. Call 0917 555 0100.')).toEqual([
      'Replace “municipal gym” with “Hillcrest Elementary School gym”.',
      'Replace “[Evacuation Centre]” with “Village Hall”.',
    ])
  })

  it('quotes the words around a stray number, so the model removes that one and no other', () => {
    expect(edits('Signal No. 3 is raised in Zone 1, and Typhoon Katy makes landfall at 6:00 PM on Nov 14. About 25 families must go to Village Hall. Call 0917 555 0100.')).toEqual([
      'Remove “25” from “About 25 families must”.',
    ])
  })

  it('asks for nothing when the draft passes', () => {
    expect(edits(GOOD_DRAFT, SAMPLE_SHEET, 'Zone 2')).toEqual([])
  })

  it('shortens a long draft and strips Markdown', () => {
    const long = 'Leave now. '.repeat(4) + 'Signal No. 3 for Zone 1, landfall at 6 PM on Nov 14; go to Village Hall or call 0917 555 0100.'
    expect(edits(long)).toEqual(['Use at most 3 sentences.'])
    expect(edits('## Alert\nSignal No. 3 for Zone 1, landfall at 6 PM on Nov 14. Go to Village Hall. Call 0917 555 0100.')).toEqual([
      'Remove “##” from the start of the line.',
    ])
  })

  it('removes a word in another script', () => {
    expect(edits(NANO_HINDI_DRAFT)).toEqual(['Remove “कृपया”.'])
  })
})

describe('fixFor', () => {
  const placeholder = (text: string): Issue => ({ rule: 'placeholders', message: '', span: { start: 0, end: text.length, text } })

  it('fills a placeholder with the fact its wording names, or removes it', () => {
    expect(fixFor(placeholder('[Hotline Number]'), SAMPLE_SHEET, 'Zone 1')).toBe('Replace “[Hotline Number]” with “0917 555 0100”.')
    expect(fixFor(placeholder('[Date]'), SAMPLE_SHEET, 'Zone 1')).toBe('Replace “[Date]” with “Nov 14”.')
    expect(fixFor(placeholder('[Village]'), SAMPLE_SHEET, 'Zone 1')).toBe('Replace “[Village]” with “Zone 1, Hillcrest Village”.')
    expect(fixFor(placeholder('TBD'), SAMPLE_SHEET, 'Zone 1')).toBe('Remove “TBD”.')
  })

  it('removes a wrong date or phone number when the fact sheet has none', () => {
    const sheet = { ...SAMPLE_SHEET, hotline: '', landfallDate: undefined }
    const { issues } = checkDraft('Call 0917 555 0199 on Nov 15.', sheet, { claimWords, required: [] })
    expect(issues.map((i) => fixFor(i, sheet, 'Zone 1'))).toEqual(['Remove “0917 555 0199”.', 'Remove “Nov 15”.'])
  })
})

describe('whenText', () => {
  it('gives the landfall time as drafts should write it', () => {
    expect(whenText(SAMPLE_SHEET)).toBe('6:00 PM on Nov 14')
    expect(whenText({ ...SAMPLE_SHEET, landfallDate: undefined })).toBe('6:00 PM')
  })
})

describe('around', () => {
  const at = (text: string, part: string) => {
    const start = text.indexOf(part)
    return around(text, { start, end: start + part.length })
  }

  it('takes two words each side, within the sentence and the line', () => {
    expect(at('Go now. About 25 families must leave.', '25')).toBe('About 25 families must')
    expect(at('Leave by 6:00 PM, with 3 bags.\nNext line.', '3')).toBe('PM, with 3 bags')
    expect(at('Bring 2.', '2')).toBe('Bring 2')
    expect(at('7 boats', '7')).toBe('7 boats')
  })

  it('keeps a glued unit with its number', () => {
    expect(at('Winds of 185km/h are coming.', '185')).toBe('Winds of 185km/h are')
  })
})

describe('landfallPhrase', () => {
  const at = (text: string) => {
    const start = text.indexOf('6:00 PM')
    return landfallPhrase(text, { start, end: start + 7 }, SAMPLE_SHEET)
  }

  it('quotes from the storm’s name to the time, in the same sentence', () => {
    expect(at('Typhoon Katy has been declared at 6:00 PM on Nov 14.')).toBe('Typhoon Katy has been declared at 6:00 PM')
    expect(at('Signal No. 3, and typhoon katy is predicted to reach the area at 6:00 PM.')).toBe(
      'typhoon katy is predicted to reach the area at 6:00 PM',
    )
  })

  it('gives nothing when the storm isn’t named just before the time', () => {
    expect(at('Typhoon Katy is coming. Bring food by 6:00 PM.')).toBeUndefined()
    expect(at('Typhoon Katy, which forecasters have been tracking closely for many days now, arrives at 6:00 PM.')).toBeUndefined()
    expect(landfallPhrase('Leave at 6:00 PM.', { start: 9, end: 16 }, { ...SAMPLE_SHEET, stormName: '' })).toBeUndefined()
  })
})
