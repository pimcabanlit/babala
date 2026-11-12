import { checkDraft, type CheckResult, type FactSheet } from '../checker'
import type { Household } from './households'

/**
 * The check for one household's alert: the same call when the console shows a
 * draft and when an approved alert is saved. Code only, so it runs on every keystroke.
 */
export function checkFor(text: string, sheet: FactSheet, area: string, household: Household, claimWords: string[]): CheckResult {
  return checkDraft(text, sheet, { claimWords, area, required: household.required })
}
