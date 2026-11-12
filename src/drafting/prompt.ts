/**
 * Draft prompts. Short on purpose: the laptop's on-device model is slow
 * (performance class Low), and every fact is stated once, exactly as the
 * checker will compare it.
 */
import type { FactSheet, Issue } from '../checker'
import { to12h } from '../factsheet/form'
import type { Household } from './households'

/** The signal number for an area, if the fact sheet has one. */
export function signalFor(sheet: FactSheet, area: string): number | undefined {
  return sheet.signals.find((s) => s.area === area)?.signal
}

export function buildDraftPrompt(sheet: FactSheet, area: string, household: Household): string {
  const signal = signalFor(sheet, area)
  const place = sheet.barangays[0] ? `${area}, ${sheet.barangays[0]}` : area
  const when = sheet.landfallDate ? `${to12h(sheet.landfallTime)} on ${sheet.landfallDate}` : to12h(sheet.landfallTime)
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
    'Write at most 3 short sentences in plain English. No emojis, no Markdown, no brackets, no placeholders.',
    'Do not add any other numbers, places, times or dates, and do not describe how strong the storm is.',
  ].join('\n')
}

/** The same prompt, plus the failed draft and the checker's reasons. */
export function buildRetryPrompt(base: string, draft: string, issues: Issue[]): string {
  const reasons = [...new Set(issues.map((i) => i.message))]
  return [
    base,
    '',
    'Your last draft was:',
    draft.trim(),
    '',
    'It broke these rules:',
    ...reasons.map((r) => `- ${r}`),
    'Write a new alert that fixes every problem.',
  ].join('\n')
}
