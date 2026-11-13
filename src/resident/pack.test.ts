import { describe, expect, it } from 'vitest'
import { GOOD_DRAFT } from '../checker/fixtures/halimbawa'
import {
  alertFor,
  choiceFromJson,
  languagesOf,
  packAreas,
  packFromJson,
  packToJson,
  readPackAlert,
  textIn,
  type ActivePackAlert,
  type Pack,
} from './pack'

const AT = Date.parse('2026-11-14T08:00:00Z')

const activeDoc = {
  household: 'general',
  area: 'Purok Ilaya',
  areaKey: 'purok-ilaya',
  signal: 3,
  stormName: 'Typhoon Sample',
  text: GOOD_DRAFT,
  status: 'active',
}

function active(id = 'general__purok-ilaya', data: Record<string, unknown> = activeDoc): ActivePackAlert {
  const alert = readPackAlert(id, data, AT)
  if (alert?.status !== 'active') throw new Error('Expected an active copy.')
  return alert
}

describe('readPackAlert', () => {
  it('reads a current alert with its English text', () => {
    expect(active()).toEqual({
      id: 'general__purok-ilaya',
      household: 'general',
      area: 'Purok Ilaya',
      areaKey: 'purok-ilaya',
      updatedAtMs: AT,
      status: 'active',
      signal: 3,
      stormName: 'Typhoon Sample',
      texts: { en: GOOD_DRAFT },
    })
  })

  it('reads a withdrawn alert with no text', () => {
    const doc = { household: 'general', area: 'Purok Ilaya', areaKey: 'purok-ilaya', status: 'withdrawn' }
    expect(readPackAlert('general__purok-ilaya', doc, AT)).toEqual({
      id: 'general__purok-ilaya',
      household: 'general',
      area: 'Purok Ilaya',
      areaKey: 'purok-ilaya',
      updatedAtMs: AT,
      status: 'withdrawn',
    })
  })

  it('reads the text of each translation and nothing else from it', () => {
    const translations = { fil: { text: 'Filipino na babala.', ledgerId: 'AbCdEfGhIjKlMnOpQrSt' }, ceb: { text: 'Pahibalo.', ledgerId: 'x' } }
    expect(active('general__purok-ilaya', { ...activeDoc, translations }).texts).toEqual({
      en: GOOD_DRAFT,
      fil: 'Filipino na babala.',
      ceb: 'Pahibalo.',
    })
  })

  it('leaves out a translation with no text, so the resident still gets English', () => {
    const translations = { fil: { text: '  ' }, ceb: 'not a map' }
    expect(active('general__purok-ilaya', { ...activeDoc, translations }).texts).toEqual({ en: GOOD_DRAFT })
  })

  it('ignores a language the app has no label for', () => {
    const translations = { xx: { text: 'Unknown.' } }
    expect(active('general__purok-ilaya', { ...activeDoc, translations }).texts).toEqual({ en: GOOD_DRAFT })
  })

  it('refuses a copy whose ID is not its household and area', () => {
    expect(readPackAlert('seniors__purok-ilaya', activeDoc, AT)).toBeUndefined()
  })

  it('refuses a current alert with no text', () => {
    expect(readPackAlert('general__purok-ilaya', { ...activeDoc, text: '' }, AT)).toBeUndefined()
  })

  it('refuses an unknown household', () => {
    expect(readPackAlert('tourists__purok-ilaya', { ...activeDoc, household: 'tourists' }, AT)).toBeUndefined()
  })

  it('refuses an unknown status', () => {
    expect(readPackAlert('general__purok-ilaya', { ...activeDoc, status: 'draft' }, AT)).toBeUndefined()
  })
})

describe('saving the pack on the phone', () => {
  const pack: Pack = {
    savedAtMs: AT + 60_000,
    alerts: [
      active('general__purok-ilaya', { ...activeDoc, translations: { fil: { text: 'Filipino na babala.' } } }),
      readPackAlert('fishers__purok-1', { household: 'fishers', area: 'Purok 1', areaKey: 'purok-1', status: 'withdrawn' }, null)!,
    ],
  }

  it('loads exactly the pack it saved, translations and withdrawn alerts included', () => {
    expect(packFromJson(packToJson(pack))).toEqual(pack)
  })

  it('treats nothing saved as no pack', () => {
    expect(packFromJson(null)).toBeUndefined()
  })

  it('treats a broken save as no pack', () => {
    expect(packFromJson('{"savedAtMs":')).toBeUndefined()
    expect(packFromJson('{"alerts":[]}')).toBeUndefined()
  })

  it('drops an alert it can’t read and keeps the rest', () => {
    const json = JSON.stringify({ savedAtMs: AT, alerts: [{ id: 'general__purok-ilaya', ...activeDoc, text: '' }, { id: 'general__purok-ilaya', ...activeDoc }] })
    expect(packFromJson(json)?.alerts).toHaveLength(1)
  })
})

describe('picking the resident’s alert', () => {
  const pack: Pack = {
    savedAtMs: AT,
    alerts: [
      active('general__purok-10', { ...activeDoc, area: 'Purok 10', areaKey: 'purok-10' }),
      active('seniors__purok-2', { ...activeDoc, household: 'seniors', area: 'Purok 2', areaKey: 'purok-2' }),
      active('general__purok-2', { ...activeDoc, area: 'Purok 2', areaKey: 'purok-2' }),
      active(),
    ],
  }

  it('lists each area once, Purok 2 before Purok 10', () => {
    expect(packAreas(pack).map((a) => a.area)).toEqual(['Purok 2', 'Purok 10', 'Purok Ilaya'])
  })

  it('lists no areas before any pack is saved', () => {
    expect(packAreas(undefined)).toEqual([])
  })

  it('finds the alert for the household and area', () => {
    expect(alertFor(pack, 'seniors', 'purok-2')?.id).toBe('seniors__purok-2')
  })

  it('finds nothing for a household with no alert in that area', () => {
    expect(alertFor(pack, 'fishers', 'purok-2')).toBeUndefined()
  })
})

describe('choosing a language', () => {
  const translated = active('general__purok-ilaya', { ...activeDoc, translations: { ceb: { text: 'Pahibalo.' } } })

  it('offers only English for an alert with no translation', () => {
    expect(languagesOf(active())).toEqual(['en'])
  })

  it('offers English first, then each translated language', () => {
    expect(languagesOf(translated)).toEqual(['en', 'ceb'])
  })

  it('shows the alert in the chosen language', () => {
    expect(textIn(translated, 'ceb')).toEqual({ language: 'ceb', text: 'Pahibalo.' })
  })

  it('falls back to English when the alert has no translation into the chosen language', () => {
    expect(textIn(translated, 'fil')).toEqual({ language: 'en', text: GOOD_DRAFT })
  })
})

describe('remembering the resident’s choice', () => {
  it('reads back the area, household and language', () => {
    expect(choiceFromJson('{"areaKey":"purok-1","household":"fishers","language":"fil"}')).toEqual({
      areaKey: 'purok-1',
      household: 'fishers',
      language: 'fil',
    })
  })

  it('drops a household or language it doesn’t know', () => {
    expect(choiceFromJson('{"areaKey":"purok-1","household":"tourists","language":"xx"}')).toEqual({ areaKey: 'purok-1' })
  })

  it('treats a broken save as no choice', () => {
    expect(choiceFromJson('not json')).toEqual({})
  })
})
