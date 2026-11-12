import type { SavedAlert } from '../alerts/record'
import { HOUSEHOLDS } from '../drafting/households'

/** Saved alerts by area, then in the households' usual order. */
export function inDisplayOrder(alerts: SavedAlert[]): SavedAlert[] {
  const rank = (a: SavedAlert) => HOUSEHOLDS.findIndex((h) => h.id === a.household)
  return [...alerts].sort((a, b) => a.area.localeCompare(b.area, 'en') || rank(a) - rank(b))
}
