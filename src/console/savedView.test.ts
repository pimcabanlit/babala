import { describe, expect, it } from 'vitest'
import type { SavedAlert } from '../alerts/record'
import { inDisplayOrder } from './savedView'

function alert(household: SavedAlert['household'], area: string): SavedAlert {
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
    withdrawn: undefined,
  }
}

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
