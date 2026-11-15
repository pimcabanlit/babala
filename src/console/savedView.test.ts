import { describe, expect, it } from 'vitest'
import type { SavedAlert } from '../alerts/record'
import { ALL_SAVED, filterCounts, groupByArea, inDisplayOrder, matchesFilter, selectedAlert } from './savedView'

function alert(household: SavedAlert['household'], area: string, withdrawn = false): SavedAlert {
  return {
    id: `${household}__${area}`,
    household,
    area,
    text: '',
    source: 'none',
    edited: false,
    approvedAt: undefined,
    pending: false,
    ledgerId: undefined,
    withdrawn: withdrawn ? { ledgerId: 'w1', by: 'uid', at: undefined } : undefined,
    factSheet: undefined,
  }
}

/** Three areas; Purok Ilaya's Seniors alert is withdrawn. */
const SAVED = [
  alert('general', 'Purok Ilaya'),
  alert('seniors', 'Purok Ilaya', true),
  alert('fishers', 'Purok Ilaya'),
  alert('general', 'Purok 1'),
  alert('general', 'Purok 2'),
]

const ids = (groups: { area: string; alerts: SavedAlert[] }[]) => groups.map((g) => `${g.area}: ${g.alerts.map((a) => a.household).join(', ')}`)

describe('the saved alerts filter', () => {
  it('shows every alert by area, in the households’ usual order, with no filter', () => {
    expect(ids(groupByArea(SAVED, ALL_SAVED))).toEqual(['Purok 1: general', 'Purok 2: general', 'Purok Ilaya: general, seniors, fishers'])
  })

  it('shows only withdrawn alerts under Withdrawn, and only the rest under Active', () => {
    expect(ids(groupByArea(SAVED, { status: 'withdrawn', area: undefined }))).toEqual(['Purok Ilaya: seniors'])
    expect(ids(groupByArea(SAVED, { status: 'active', area: 'Purok Ilaya' }))).toEqual(['Purok Ilaya: general, fishers'])
  })

  it('matches an area only by its exact name', () => {
    expect(matchesFilter(alert('general', 'Purok 1'), { status: 'all', area: 'Purok 12' })).toBe(false)
  })

  it('counts each status within the chosen area, and each area within the chosen status', () => {
    expect(filterCounts(SAVED, { status: 'active', area: 'Purok Ilaya' })).toEqual({
      status: { all: 3, active: 2, withdrawn: 1 },
      areas: [
        { area: 'Purok 1', count: 1 },
        { area: 'Purok 2', count: 1 },
        { area: 'Purok Ilaya', count: 2 },
      ],
    })
  })

  it('keeps the picked alert while the filter shows it, and falls back to the first one shown', () => {
    const all = groupByArea(SAVED, ALL_SAVED)
    expect(selectedAlert(all, 'fishers__Purok Ilaya')?.id).toBe('fishers__Purok Ilaya')
    expect(selectedAlert(groupByArea(SAVED, { status: 'withdrawn', area: undefined }), 'fishers__Purok Ilaya')?.id).toBe('seniors__Purok Ilaya')
    expect(selectedAlert(all, undefined)?.id).toBe('general__Purok 1')
    expect(selectedAlert([], 'general__Purok 1')).toBeUndefined()
  })
})

describe('inDisplayOrder', () => {
  it('sorts by area, then by the households’ usual order', () => {
    const order = inDisplayOrder([alert('fishers', 'Purok Ilaya'), alert('general', 'Purok Ilaya'), alert('general', 'Purok 2')])
    expect(order.map((a) => a.id)).toEqual(['general__Purok 2', 'general__Purok Ilaya', 'fishers__Purok Ilaya'])
  })

  it('leaves the list it was given as it was', () => {
    const list = [alert('general', 'Purok Ilaya'), alert('general', 'Purok 2')]
    inDisplayOrder(list)
    expect(list[0]?.area).toBe('Purok Ilaya')
  })
})
