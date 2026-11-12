/**
 * Draft prompts. Short on purpose: the laptop's on-device model is slow
 * (performance class Low), and every fact is stated once, exactly as the
 * checker will compare it.
 */
import type { FactSheet, Issue } from '../checker'
import { editsFor, whenText } from './fixes'
import type { Household } from './households'

/** The signal number for an area, if the fact sheet has one. */
export function signalFor(sheet: FactSheet, area: string): number | undefined {
  return sheet.signals.find((s) => s.area === area)?.signal
}

export function buildDraftPrompt(sheet: FactSheet, area: string, household: Household): string {
  const signal = signalFor(sheet, area)
  const place = sheet.barangays[0] ? `${area}, ${sheet.barangays[0]}` : area
  const when = whenText(sheet)
  const facts = [
    sheet.stormName && `Storm: ${sheet.stormName}`,
    signal !== undefined && `Signal No. ${signal} in ${area}`,
    `Landfall: ${when}`,
    `Evacuation centre: ${sheet.evacuationCentres.join(' or ')}`,
    sheet.hotline && `Hotline: ${sheet.hotline}`,
  ].filter(Boolean)
  return [
    `Write a typhoon alert for ${household.audience} in ${place}.`,
    'Use these facts exactly as written, and no other facts:',
    ...facts.map((f) => `- ${f}`),
    household.advice,
    `Say when as “${when}”, with no other time words.`,
    'Write at most 3 short sentences in plain English. No emojis, no Markdown, no brackets, no placeholders.',
    'Do not add any other numbers, places, times or dates, and do not describe how strong the storm is.',
  ].join('\n')
}

/**
 * The retry: the failed draft back, with one concrete edit per problem.
 * A small on-device model follows "Remove “today”" far better than the whole
 * prompt again, and the shorter prompt runs faster on the laptop.
 */
export function buildRetryPrompt(draft: string, issues: Issue[], sheet: FactSheet, area: string): string {
  const edits = editsFor(issues, sheet, area, draft)
  return [
    'Here is a typhoon alert:',
    draft.trim(),
    '',
    'Rewrite it with these changes, and keep everything else the same:',
    ...edits.map((e) => `- ${e}`),
    'Reply with only the new alert, in plain text.',
  ].join('\n')
}
