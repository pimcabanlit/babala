/**
 * The copy of each saved alert that residents read, at
 * `residentAlerts/{household}__{areaKey}` (the alert's own ID).
 *
 * Residents can't read `alerts`: it holds the officers' user IDs (approvedBy,
 * withdrawal.by) and the whole bulletin. Firestore rules can't hide single
 * fields, so residents get a separate document with only what they need. It
 * is written in the same batch as every approval and withdrawal, and
 * firestore.rules requires it to equal residentCopy() of the alert after the
 * batch, so it can't say anything the alert doesn't. Once an alert is
 * withdrawn its copy loses the text, so residents never see a withdrawn alert.
 *
 * Pure code, so the console and the rules tests build the same documents.
 * Change it together with residentCopy() in firestore.rules.
 */
import type { HouseholdId } from '../drafting/households'
import type { AlertRecord, SavedAlert } from './record'

export const RESIDENT_ALERTS = 'residentAlerts'

/** What residents read while the alert is current. The store adds updatedAt: the approval's server time. */
export type ActiveCopy = {
  household: HouseholdId
  area: string
  areaKey: string
  signal: number
  stormName: string
  /** The alert exactly as the checker passed it and the officer approved it. */
  text: string
  status: 'active'
}

/** What residents read once the alert is withdrawn: no text. The store adds updatedAt: the withdrawal's server time. */
export type WithdrawnCopy = {
  household: HouseholdId
  area: string
  areaKey: string
  status: 'withdrawn'
}

export function activeCopy(alert: AlertRecord): ActiveCopy {
  return {
    household: alert.household,
    area: alert.area,
    areaKey: alert.areaKey,
    signal: alert.signal,
    stormName: alert.factSheet.stormName,
    text: alert.text,
    status: 'active',
  }
}

/** The area key is the part of the alert's ID after `{household}__`. */
export function withdrawnCopy(saved: Pick<SavedAlert, 'id' | 'household' | 'area'>): WithdrawnCopy {
  return {
    household: saved.household,
    area: saved.area,
    areaKey: saved.id.slice(saved.household.length + 2),
    status: 'withdrawn',
  }
}
