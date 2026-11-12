import { describe, expect, it } from 'vitest'
import { SAMPLE_BULLETIN, SAMPLE_SHEET } from '../checker/fixtures/halimbawa'
import { parseBulletin, sentences } from './parse'

describe('parseBulletin', () => {
  it('reads the demo bulletin into the same fact sheet the checker tests use', () => {
    expect(parseBulletin(SAMPLE_BULLETIN)).toEqual({ sheet: SAMPLE_SHEET, notFound: [] })
  })

  it('reads a bulletin written as one paragraph, with other spellings', () => {
    const text =
      'Tropical Storm Halimbawa-Dos: TCWS No. 2 is up for Purok Silangan, Purok 4, and Purok 5 of Brgy. Uno. ' +
      'Landfall is expected at 1800H, 15 November. Families should evacuate to the Uno Covered Court, the Uno Chapel and Uno Elementary School. ' +
      'For help, call the hotline at +63 917 555 0199.'
    const { sheet, notFound } = parseBulletin(text)
    expect(notFound).toEqual([])
    expect(sheet.stormName).toBe('Tropical Storm Halimbawa-Dos')
    expect(sheet.signals).toEqual([
      { area: 'Purok Silangan', signal: 2 },
      { area: 'Purok 4', signal: 2 },
      { area: 'Purok 5', signal: 2 },
    ])
    expect(sheet.landfallTime).toBe('18:00')
    expect(sheet.landfallDate).toBe('15 November')
    expect(sheet.evacuationCentres).toEqual(['Uno Covered Court', 'Uno Chapel', 'Uno Elementary School'])
    expect(sheet.puroks).toEqual(['Purok Silangan', 'Purok 4', 'Purok 5'])
    expect(sheet.barangays).toEqual(['Brgy. Uno'])
    expect(sheet.hotline).toBe('+63 917 555 0199')
    expect(sheet.otherFigures).toEqual([])
  })

  it('lists what it could not find, so the officer fills it in', () => {
    const { sheet, notFound } = parseBulletin('Stay alert and wait for the next bulletin.')
    expect(notFound).toEqual(['storm name', 'signal numbers', 'landfall time', 'evacuation centres', 'hotline'])
    expect(sheet.signals).toEqual([])
  })
})

describe('sentences', () => {
  it('does not split after "No." or "Brgy."', () => {
    expect(sentences('Signal No. 3 for Brgy. Uno. Evacuate now.')).toEqual(['Signal No. 3 for Brgy. Uno', 'Evacuate now.'])
  })
})
