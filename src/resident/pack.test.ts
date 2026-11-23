import { describe, expect, it } from 'vitest'
import { GOOD_DRAFT } from '../checker/fixtures/hillcrest'
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
  area: 'Zone 2',
  areaKey: 'zone-2',
  signal: 3,
  stormName: 'Typhoon Katy',
  text: GOOD_DRAFT,
  status: 'active',
}

function active(id = 'general__zone-2', data: Record<string, unknown> = activeDoc): ActivePackAlert {
  const alert = readPackAlert(id, data, AT)
  if (alert?.status !== 'active') throw new Error('Expected an active copy.')
  return alert
}

describe('readPackAlert', () => {
  it('reads a current alert with its English text', () => {
    expect(active()).toEqual({
      id: 'general__zone-2',
      household: 'general',
      area: 'Zone 2',
      areaKey: 'zone-2',
      updatedAtMs: AT,
      status: 'active',
      signal: 3,
      stormName: 'Typhoon Katy',
      texts: { en: GOOD_DRAFT },
    })
  })

  it('reads a withdrawn alert with no text', () => {
    const doc = { household: 'general', area: 'Zone 2', areaKey: 'zone-2', status: 'withdrawn' }
    expect(readPackAlert('general__zone-2', doc, AT)).toEqual({
      id: 'general__zone-2',
      household: 'general',
      area: 'Zone 2',
      areaKey: 'zone-2',
      updatedAtMs: AT,
      status: 'withdrawn',
    })
  })

  it('reads the text of each translation and nothing else from it', () => {
    const translations = { fil: { text: 'Filipino na babala.', ledgerId: 'AbCdEfGhIjKlMnOpQrSt' }, ceb: { text: 'Pahibalo.', ledgerId: 'x' } }
    expect(active('general__zone-2', { ...activeDoc, translations }).texts).toEqual({
      en: GOOD_DRAFT,
      fil: 'Filipino na babala.',
      ceb: 'Pahibalo.',
    })
  })

  it('leaves out a translation with no text, so the resident still gets English', () => {
    const translations = { fil: { text: '  ' }, ceb: 'not a map' }
    expect(active('general__zone-2', { ...activeDoc, translations }).texts).toEqual({ en: GOOD_DRAFT })
  })

  it('ignores a language the app has no label for', () => {
    const translations = { xx: { text: 'Unknown.' } }
    expect(active('general__zone-2', { ...activeDoc, translations }).texts).toEqual({ en: GOOD_DRAFT })
  })

  it('refuses a copy whose ID is not its household and area', () => {
    expect(readPackAlert('seniors__zone-2', activeDoc, AT)).toBeUndefined()
  })

  it('refuses a current alert with no text', () => {
    expect(readPackAlert('general__zone-2', { ...activeDoc, text: '' }, AT)).toBeUndefined()
  })

  it('refuses an unknown household', () => {
    expect(readPackAlert('tourists__zone-2', { ...activeDoc, household: 'tourists' }, AT)).toBeUndefined()
  })

  it('refuses an unknown status', () => {
    expect(readPackAlert('general__zone-2', { ...activeDoc, status: 'draft' }, AT)).toBeUndefined()
  })
})

describe('saving the pack on the phone', () => {
  const pack: Pack = {
    savedAtMs: AT + 60_000,
    alerts: [
      active('general__zone-2', { ...activeDoc, translations: { fil: { text: 'Filipino na babala.' } } }),
      readPackAlert('fishers__zone-1', { household: 'fishers', area: 'Zone 1', areaKey: 'zone-1', status: 'withdrawn' }, null)!,
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
    const json = JSON.stringify({ savedAtMs: AT, alerts: [{ id: 'general__zone-2', ...activeDoc, text: '' }, { id: 'general__zone-2', ...activeDoc }] })
    expect(packFromJson(json)?.alerts).toHaveLength(1)
  })
})

describe('picking the resident’s alert', () => {
  const pack: Pack = {
    savedAtMs: AT,
    alerts: [
      active('general__zone-10', { ...activeDoc, area: 'Zone 10', areaKey: 'zone-10' }),
      active('seniors__zone-3', { ...activeDoc, household: 'seniors', area: 'Zone 3', areaKey: 'zone-3' }),
      active('general__zone-3', { ...activeDoc, area: 'Zone 3', areaKey: 'zone-3' }),
      active(),
    ],
  }

  it('lists each area once, Zone 2 before Zone 10', () => {
    expect(packAreas(pack).map((a) => a.area)).toEqual(['Zone 2', 'Zone 3', 'Zone 10'])
  })

  it('lists no areas before any pack is saved', () => {
    expect(packAreas(undefined)).toEqual([])
  })

  it('finds the alert for the household and area', () => {
    expect(alertFor(pack, 'seniors', 'zone-3')?.id).toBe('seniors__zone-3')
  })

  it('finds nothing for a household with no alert in that area', () => {
    expect(alertFor(pack, 'fishers', 'zone-3')).toBeUndefined()
  })
})

describe('choosing a language', () => {
  const translated = active('general__zone-2', { ...activeDoc, translations: { ceb: { text: 'Pahibalo.' } } })

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
    expect(choiceFromJson('{"areaKey":"zone-1","household":"fishers","language":"fil"}')).toEqual({
      areaKey: 'zone-1',
      household: 'fishers',
      language: 'fil',
    })
  })

  it('drops a household or language it doesn’t know', () => {
    expect(choiceFromJson('{"areaKey":"zone-1","household":"tourists","language":"xx"}')).toEqual({ areaKey: 'zone-1' })
  })

  it('treats a broken save as no choice', () => {
    expect(choiceFromJson('not json')).toEqual({})
  })
})
