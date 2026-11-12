import { describe, expect, it } from 'vitest'
import { SAMPLE_BULLETIN, SAMPLE_SHEET } from '../checker/fixtures/halimbawa'
import { fromForm, to12h, toForm } from './form'

describe('fact sheet form', () => {
  it('round-trips the sample fact sheet', () => {
    const form = toForm(SAMPLE_SHEET)
    expect(form.signals).toBe('Purok 1: 3\nPurok Ilaya: 3\nPurok 2: 2')
    expect(form.landfallTime).toBe('6:00 PM')
    expect(fromForm(form, SAMPLE_BULLETIN)).toEqual({ ok: true, sheet: SAMPLE_SHEET })
  })

  it('lists every problem instead of drafting from a broken fact sheet', () => {
    const form = { ...toForm(SAMPLE_SHEET), signals: 'Purok 1 is 3', landfallTime: 'evening', evacuationCentres: ' ', otherFigures: '185, lots' }
    expect(fromForm(form, SAMPLE_BULLETIN)).toEqual({
      ok: false,
      problems: [
        'Signal line “Purok 1 is 3” should look like “Purok 1: 3”.',
        'Landfall time should look like “6:00 PM” or “18:00”.',
        'Add at least one evacuation centre.',
        '“lots” in other figures is not a number.',
      ],
    })
  })

  it('allows an empty hotline and date', () => {
    const result = fromForm({ ...toForm(SAMPLE_SHEET), hotline: '', landfallDate: '' }, SAMPLE_BULLETIN)
    expect(result.ok && result.sheet.hotline).toBe('')
    expect(result.ok && 'landfallDate' in result.sheet).toBe(false)
  })
})

describe('to12h', () => {
  it.each([
    ['18:00', '6:00 PM'],
    ['00:30', '12:30 AM'],
    ['12:00', '12:00 PM'],
    ['09:05', '9:05 AM'],
  ])('%s is %s', (hhmm, expected) => {
    expect(to12h(hhmm)).toBe(expected)
  })
})
