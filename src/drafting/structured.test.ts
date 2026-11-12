import { describe, expect, it } from 'vitest'
import { ALERT_SCHEMA, alertFromJson, previewFromPartialJson, readAnswer } from './structured'

const answer = JSON.stringify({
  signal_and_landfall: 'Signal No. 3 is raised in Purok 1, and Typhoon Sample makes landfall at 6:00 PM on Nov 14',
  what_to_do_and_where_to_go: '  Leave now, and go to Barangay Hall. ',
  hotline: 'Call the hotline, 0917 555 0100, for help.',
})

describe('alertFromJson', () => {
  it('joins the fields in order, one sentence each, adding a missing full stop', () => {
    expect(alertFromJson(answer)).toBe(
      'Signal No. 3 is raised in Purok 1, and Typhoon Sample makes landfall at 6:00 PM on Nov 14. Leave now, and go to Barangay Hall. Call the hotline, 0917 555 0100, for help.',
    )
  })

  it('leaves out an empty or missing hotline, and ignores fields it did not ask for', () => {
    expect(alertFromJson('{"signal_and_landfall":"A.","what_to_do_and_where_to_go":"B.","hotline":"","extra":"C."}')).toBe('A. B.')
  })

  it('returns undefined for anything that is not a JSON object with text', () => {
    for (const bad of ['', 'Signal No. 3.', '[]', 'null', '{}', '{"signal_and_landfall": 3}', '{"signal_and_landfall":"A."'])
      expect(alertFromJson(bad), bad).toBeUndefined()
  })
})

describe('readAnswer', () => {
  it('falls back to the raw text, so the checker judges a model that ignored the schema', () => {
    expect(readAnswer(' 1. Signal No. 3.\n2. Leave. ')).toBe('1. Signal No. 3.\n2. Leave.')
    expect(readAnswer(answer)).toMatch(/^Signal No\. 3/)
  })
})

describe('previewFromPartialJson', () => {
  it('shows the sentences written so far while the JSON streams in', () => {
    expect(previewFromPartialJson('{"signal_and_landfall": "Signal No. 3 is ra')).toBe('Signal No. 3 is ra')
    expect(previewFromPartialJson('{"signal_and_landfall":"A \\"quoted\\" word.","what_to_do_and_where_to_go":"Leave')).toBe(
      'A "quoted" word. Leave',
    )
    expect(previewFromPartialJson('{"signal_and')).toBe('')
  })
})

describe('ALERT_SCHEMA', () => {
  it('asks for three strings in sentence order, with the hotline optional', () => {
    expect(Object.keys(ALERT_SCHEMA.properties)).toEqual(['signal_and_landfall', 'what_to_do_and_where_to_go', 'hotline'])
    expect(ALERT_SCHEMA.required).toEqual(['signal_and_landfall', 'what_to_do_and_where_to_go'])
  })
})
