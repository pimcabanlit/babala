import { describe, expect, it } from 'vitest'
import { CHECKER_CLAIM_WORDS } from '../config/defaults'
import { GOOD_DRAFT, SAMPLE_SHEET } from '../checker/fixtures/halimbawa'
import { HOUSEHOLDS } from '../drafting/households'
import { LIMITS, alertDocId, approvedAlert, areaKey, readSavedAlert, type ApprovalInput } from './record'

const general = HOUSEHOLDS.find((h) => h.id === 'general')!

/** GOOD_DRAFT for the general household in Purok Ilaya, written on the laptop. */
const input: ApprovalInput = {
  text: GOOD_DRAFT,
  sheet: SAMPLE_SHEET,
  area: 'Purok Ilaya',
  household: general,
  claimWords: [...CHECKER_CLAIM_WORDS],
  source: 'on_device',
  edited: false,
}

describe('areaKey', () => {
  it('turns a purok name into lower case words joined by dashes', () => {
    expect(areaKey('Purok Ilaya')).toBe('purok-ilaya')
  })

  it('drops accents, so “Purok Niño” and “Purok Nino” share a key', () => {
    expect(areaKey('Purok Niño 2')).toBe('purok-nino-2')
  })

  it('turns any run of spaces and punctuation into one dash, with none at the ends', () => {
    expect(areaKey('  Purok 1 / Sitio  Baybay. ')).toBe('purok-1-sitio-baybay')
  })

  it('has no key for a name with no letters or numbers', () => {
    expect(areaKey(' — ')).toBeUndefined()
  })
})

describe('alertDocId', () => {
  it('joins the household and the area key with two underscores', () => {
    expect(alertDocId('fishers', 'purok-ilaya')).toBe('fishers__purok-ilaya')
  })
})

describe('approvedAlert', () => {
  it('builds the document for an alert that passes the checker', () => {
    const approval = approvedAlert(input)
    expect(approval).toEqual({
      ok: true,
      id: 'general__purok-ilaya',
      record: {
        household: 'general',
        area: 'Purok Ilaya',
        areaKey: 'purok-ilaya',
        signal: 3,
        text: GOOD_DRAFT,
        factSheet: SAMPLE_SHEET,
        source: 'on_device',
        edited: false,
      },
    })
  })

  it('saves the text without the spaces and blank lines around it', () => {
    const approval = approvedAlert({ ...input, text: `\n  ${GOOD_DRAFT}  \n\n` })
    expect(approval.ok && approval.record.text).toBe(GOOD_DRAFT)
  })

  it('refuses an alert that fails the checker, with the first problem', () => {
    const approval = approvedAlert({ ...input, text: GOOD_DRAFT.replace('Signal No. 3', 'Signal No. 3, a severe storm,') })
    expect(approval).toEqual({ ok: false, reason: expect.stringContaining('The alert fails the checker: ') })
    expect(!approval.ok && approval.reason).toContain('severe')
  })

  it('refuses an area that is not in the fact sheet', () => {
    expect(approvedAlert({ ...input, area: 'Purok 9' })).toEqual({ ok: false, reason: '“Purok 9” is not an area in the fact sheet.' })
  })

  it('refuses to save before the checker’s claim words have loaded', () => {
    const approval = approvedAlert({ ...input, claimWords: [] })
    expect(approval).toEqual({ ok: false, reason: expect.stringContaining('word list') })
  })

  it('refuses a bulletin longer than Firestore rules allow', () => {
    const long = SAMPLE_SHEET.bulletinText + ' '.repeat(LIMITS.bulletinText)
    const approval = approvedAlert({ ...input, sheet: { ...SAMPLE_SHEET, bulletinText: long } })
    expect(approval).toEqual({ ok: false, reason: 'The bulletin is too long to save (at most 20,000).' })
  })

  it('leaves out a landfall date the fact sheet does not have, since Firestore refuses undefined', () => {
    const text = GOOD_DRAFT.replace(' on Nov 14', '')
    const approval = approvedAlert({ ...input, text, sheet: { ...SAMPLE_SHEET, landfallDate: undefined } })
    expect(approval.ok).toBe(true)
    expect(approval.ok && Object.keys(approval.record.factSheet)).not.toContain('landfallDate')
  })

  it('keeps who wrote the text and whether the officer edited it', () => {
    const approval = approvedAlert({ ...input, source: 'none', edited: true })
    expect(approval.ok && [approval.record.source, approval.record.edited]).toEqual(['none', true])
  })
})

describe('readSavedAlert', () => {
  const data = { household: 'fishers', area: 'Purok 2', text: 'Alert text.', source: 'in_cloud', edited: true }
  const at = new Date('2026-11-14T08:00:00Z')

  it('reads a saved alert with its time and upload state', () => {
    expect(readSavedAlert('fishers__purok-2', data, at, true)).toEqual({
      id: 'fishers__purok-2',
      household: 'fishers',
      area: 'Purok 2',
      text: 'Alert text.',
      source: 'in_cloud',
      edited: true,
      approvedAt: at,
      pending: true,
    })
  })

  it('ignores a document with an unknown household', () => {
    expect(readSavedAlert('x', { ...data, household: 'tourists' }, at, false)).toBeUndefined()
  })

  it('ignores a document whose text is not a string', () => {
    expect(readSavedAlert('x', { ...data, text: 42 }, at, false)).toBeUndefined()
  })
})
