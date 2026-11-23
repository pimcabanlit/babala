import { describe, expect, it } from 'vitest'
import { parseBulletin } from './parse'
import { LONG_BULLETIN, SAMPLE_BULLETIN, datedDemoBulletin } from './sample'

describe('datedDemoBulletin', () => {
  it('sets the demo landfall to the day after today', () => {
    const text = datedDemoBulletin(SAMPLE_BULLETIN, new Date(2026, 10, 25, 21, 30))
    expect(parseBulletin(text).sheet.landfallDate).toBe('Nov 26')
  })

  it('rolls the landfall into the next month on the last day of a month', () => {
    const text = datedDemoBulletin(SAMPLE_BULLETIN, new Date(2026, 10, 30))
    expect(parseBulletin(text).sheet.landfallDate).toBe('Dec 1')
  })

  it('dates the long bulletin as issued today', () => {
    const text = datedDemoBulletin(LONG_BULLETIN, new Date(2026, 11, 10))
    expect(text).toContain('Issued at 11:00 AM, 10 December 2026')
    expect(text).toContain('around 6:00 PM on Dec 11.')
  })

  it('leaves no trace of the fixed Nov 14 date', () => {
    const text = datedDemoBulletin(LONG_BULLETIN, new Date(2026, 11, 10))
    expect(text).not.toMatch(/14 November|Nov 14/)
  })
})
