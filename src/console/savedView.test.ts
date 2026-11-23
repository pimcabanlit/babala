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

/** Three areas; Zone 2's Seniors alert is withdrawn. */
const SAVED = [
  alert('general', 'Zone 2'),
  alert('seniors', 'Zone 2', true),
  alert('fishers', 'Zone 2'),
  alert('general', 'Zone 1'),
  alert('general', 'Zone 3'),
]

const ids = (groups: { area: string; alerts: SavedAlert[] }[]) => groups.map((g) => `${g.area}: ${g.alerts.map((a) => a.household).join(', ')}`)

describe('the saved alerts filter', () => {
  it('shows every alert by area, in the households’ usual order, with no filter', () => {
    expect(ids(groupByArea(SAVED, ALL_SAVED))).toEqual(['Zone 1: general', 'Zone 2: general, seniors, fishers', 'Zone 3: general'])
  })

  it('shows only withdrawn alerts under Withdrawn, and only the rest under Active', () => {
    expect(ids(groupByArea(SAVED, { status: 'withdrawn', area: undefined }))).toEqual(['Zone 2: seniors'])
    expect(ids(groupByArea(SAVED, { status: 'active', area: 'Zone 2' }))).toEqual(['Zone 2: general, fishers'])
  })

  it('matches an area only by its exact name', () => {
    expect(matchesFilter(alert('general', 'Zone 1'), { status: 'all', area: 'Zone 12' })).toBe(false)
  })

  it('counts each status within the chosen area, and each area within the chosen status', () => {
    expect(filterCounts(SAVED, { status: 'active', area: 'Zone 2' })).toEqual({
      status: { all: 3, active: 2, withdrawn: 1 },
      areas: [
        { area: 'Zone 1', count: 1 },
        { area: 'Zone 2', count: 2 },
        { area: 'Zone 3', count: 1 },
      ],
    })
  })

  it('keeps the picked alert while the filter shows it, and falls back to the first one shown', () => {
    const all = groupByArea(SAVED, ALL_SAVED)
    expect(selectedAlert(all, 'fishers__Zone 2')?.id).toBe('fishers__Zone 2')
    expect(selectedAlert(groupByArea(SAVED, { status: 'withdrawn', area: undefined }), 'fishers__Zone 2')?.id).toBe('seniors__Zone 2')
    expect(selectedAlert(all, undefined)?.id).toBe('general__Zone 1')
    expect(selectedAlert([], 'general__Zone 1')).toBeUndefined()
  })
})

describe('inDisplayOrder', () => {
  it('sorts by area, then by the households’ usual order', () => {
    const order = inDisplayOrder([alert('general', 'Zone 3'), alert('fishers', 'Zone 2'), alert('general', 'Zone 2')])
    expect(order.map((a) => a.id)).toEqual(['general__Zone 2', 'fishers__Zone 2', 'general__Zone 3'])
  })

  it('leaves the list it was given as it was', () => {
    const list = [alert('general', 'Zone 3'), alert('general', 'Zone 2')]
    inDisplayOrder(list)
    expect(list[0]?.area).toBe('Zone 3')
  })
})
