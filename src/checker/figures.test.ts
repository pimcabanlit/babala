import { describe, expect, it } from 'vitest'
import { extractFigures, normalizeDate, normalizePhone, normalizeTime } from './figures'

const values = (text: string) => extractFigures(text).map((f) => `${f.kind}:${f.value}`)

describe('normalizeTime', () => {
  it.each([
    ['6 PM', '18:00'],
    ['6PM', '18:00'],
    ['6:00 PM', '18:00'],
    ['6 p.m.', '18:00'],
    ['6:00 p.m.', '18:00'],
    ['18:00', '18:00'],
    ['1800H', '18:00'],
    ['1800 hrs', '18:00'],
    ['12 AM', '00:00'],
    ['12 PM', '12:00'],
    ['noon', '12:00'],
    ['midnight', '00:00'],
    ['6:30 am', '06:30'],
    ['alas-6 ng gabi', '18:00'],
    ['alas 6 sa gabii', '18:00'],
    ['alas-6:30 ng umaga', '06:30'],
    ['alas-12 ng tanghali', '12:00'],
    ['alas-12 ng gabi', '00:00'],
    ['alas-3 ng hapon', '15:00'],
    ['alas-sais ng gabi', '18:00'],
    ['alas dose sa udto', '12:00'],
    ['six PM', '18:00'],
    ['Six p.m.', '18:00'],
  ])('%s is %s', (text, expected) => {
    expect(normalizeTime(text)).toBe(expected)
  })

  it('rejects impossible times', () => {
    expect(normalizeTime('13 PM')).toBeUndefined()
    expect(normalizeTime('25:00')).toBeUndefined()
  })
})

describe('normalizeDate', () => {
  it.each([
    ['Nov 14', '11-14'],
    ['November 14, 2026', '11-14'],
    ['Nov. 14th', '11-14'],
    ['14 November', '11-14'],
    ['14th of Nov', '11-14'],
  ])('%s is %s', (text, expected) => {
    expect(normalizeDate(text)).toBe(expected)
  })
})

describe('normalizePhone', () => {
  it('compares phone numbers by digits, with +63 equal to 0', () => {
    expect(normalizePhone('0917 555 0100')).toBe('09175550100')
    expect(normalizePhone('+63 917-555-0100')).toBe('09175550100')
    expect(normalizePhone('(0917) 555.0100')).toBe('09175550100')
  })
})

describe('extractFigures', () => {
  it('finds each kind once, without double-counting digits inside a time or signal', () => {
    expect(values('Signal No. 3 is up. Landfall at 6:00 PM on Nov 14. Call 0917 555 0100. Winds of 185 km/h.')).toEqual([
      'signal:3',
      'time:18:00',
      'date:11-14',
      'phone:09175550100',
      'number:185',
    ])
  })

  it('reads signal numbers in several spellings', () => {
    expect(values('Signal #2, Signal Number 4, TCWS No. 1, signal 5')).toEqual([
      'signal:2',
      'signal:4',
      'signal:1',
      'signal:5',
    ])
  })

  it('skips ignored spans such as a known "Purok 2"', () => {
    const text = 'Residents of Purok 2 should leave by 5 PM.'
    const start = text.indexOf('Purok 2')
    expect(extractFigures(text, [{ start, end: start + 7, text: 'Purok 2' }]).map((f) => f.value)).toEqual(['17:00'])
  })

  it('keeps offsets pointing at the original text', () => {
    const text = 'Landfall 6 PM.'
    const [f] = extractFigures(text)
    expect(text.slice(f.span.start, f.span.end)).toBe(f.span.text)
    expect(f.span.text).toBe('6 PM')
  })

  it('keeps "Signal No. 2 may be raised" a signal, not a date in May', () => {
    expect(values('Signal No. 2 may be raised.')).toEqual(['signal:2'])
    expect(values('Landfall on 2 May.')).toEqual(['date:05-02'])
  })

  it('reads spelled-out signal numbers', () => {
    expect(values('Signal No. Three, signal number four')).toEqual(['signal:3', 'signal:4'])
  })

  it('reads numbers glued to units, thousands and decimals', () => {
    expect(values('Winds of 200km/h, 1,000 families, 1.5 meters, Puroks 1,5')).toEqual([
      'number:200',
      'number:1000',
      'number:1.5',
      'number:1',
      'number:5',
    ])
  })
})

describe('Filipino and Cebuano dates', () => {
  it.each([
    ['Nobyembre 14', '11-14'],
    ['ika-14 ng Nobyembre', '11-14'],
    ['Mayo 3', '05-03'],
    ['Marso 9', '03-09'],
  ])('reads “%s” as %s', (text, value) => {
    expect(normalizeDate(text)).toBe(value)
  })
})
