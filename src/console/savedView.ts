import type { SavedAlert } from '../alerts/record'
import { HOUSEHOLDS } from '../drafting/households'

/** Saved alerts by area, then in the households' usual order. */
export function inDisplayOrder(alerts: SavedAlert[]): SavedAlert[] {
  const rank = (a: SavedAlert) => HOUSEHOLDS.findIndex((h) => h.id === a.household)
  return [...alerts].sort((a, b) => a.area.localeCompare(b.area, 'en') || rank(a) - rank(b))
}

export type SavedStatus = 'all' | 'active' | 'withdrawn'

/** The filter chips' choice: one status, and one area or every area. */
export type SavedFilter = { status: SavedStatus; area: string | undefined }

export const ALL_SAVED: SavedFilter = { status: 'all', area: undefined }

function hasStatus(alert: SavedAlert, status: SavedStatus): boolean {
  return status === 'all' || (status === 'withdrawn') === Boolean(alert.withdrawn)
}

export function matchesFilter(alert: SavedAlert, filter: SavedFilter): boolean {
  return hasStatus(alert, filter.status) && (filter.area === undefined || alert.area === filter.area)
}

/**
 * The number beside each chip. A status counts the alerts in the chosen area,
 * and an area counts the alerts with the chosen status, so each number says
 * what picking that chip would show.
 */
export function filterCounts(alerts: SavedAlert[], filter: SavedFilter): { status: Record<SavedStatus, number>; areas: { area: string; count: number }[] } {
  const inArea = alerts.filter((a) => filter.area === undefined || a.area === filter.area)
  const areas = [...new Set(inDisplayOrder(alerts).map((a) => a.area))]
  return {
    status: {
      all: inArea.length,
      active: inArea.filter((a) => !a.withdrawn).length,
      withdrawn: inArea.filter((a) => a.withdrawn).length,
    },
    areas: areas.map((area) => ({ area, count: alerts.filter((a) => a.area === area && hasStatus(a, filter.status)).length })),
  }
}

/** The alerts the filter shows, by area in display order. */
export function groupByArea(alerts: SavedAlert[], filter: SavedFilter): { area: string; alerts: SavedAlert[] }[] {
  const groups: { area: string; alerts: SavedAlert[] }[] = []
  for (const alert of inDisplayOrder(alerts).filter((a) => matchesFilter(a, filter))) {
    const last = groups.at(-1)
    if (last?.area === alert.area) last.alerts.push(alert)
    else groups.push({ area: alert.area, alerts: [alert] })
  }
  return groups
}

/** The alert the detail panel shows: the one picked, while the filter shows it, or else the first one shown. */
export function selectedAlert(groups: { alerts: SavedAlert[] }[], id: string | undefined): SavedAlert | undefined {
  const shown = groups.flatMap((g) => g.alerts)
  return shown.find((a) => a.id === id) ?? shown[0]
}
