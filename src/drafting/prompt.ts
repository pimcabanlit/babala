/**
 * Draft prompts. Short on purpose: the laptop's on-device model is slow
 * (performance class Low), and every fact is stated once, exactly as the
 * checker will compare it.
 */
import type { FactSheet, Issue } from '../checker'
import { editsFor, whenText } from './fixes'
import type { Household } from './households'
import { ALERT_FIELDS } from './structured'

/** The signal number for an area, if the fact sheet has one. */
export function signalFor(sheet: FactSheet, area: string): number | undefined {
  return sheet.signals.find((s) => s.area === area)?.signal
}

/**
 * The alert itself, one sentence per field, in the resident's voice. Nano can't
 * count sentences ("at most 3" gave 4 to 6 on the laptop) but follows given
 * sentences, and they put the landfall time where it belongs. Written so that
 * a model copying them word for word still produces a passing alert: on Nov 12
 * the cloud copied an earlier outline, "Tell them to…" and all.
 */
export function outline(sheet: FactSheet, area: string, household: Household): string[] {
  const signal = signalFor(sheet, area)
  const storm = sheet.stormName || 'The typhoon'
  const landfall = `${storm} makes landfall at ${whenText(sheet)}`
  const lines = [
    signal !== undefined ? `Signal No. ${signal} is raised in ${area}, and ${landfall}.` : `${landfall}.`,
    `${household.advice}, and go to ${sheet.evacuationCentres.join(' or ')}.`,
  ]
  if (sheet.hotline) lines.push(`Call the hotline, ${sheet.hotline}, for help.`)
  return lines
}

/**
 * The outline as the answer's fields: "signal_and_landfall: Signal No. 3 is…".
 * Both models answer in JSON with these fields (src/drafting/structured.ts),
 * so a field can hold only its own sentence, and there is no list to number.
 */
const fielded = (lines: string[]) => lines.map((l, i) => `${ALERT_FIELDS[i]}: ${l}`)

const ONE_EACH = 'Fill in each field with one sentence.'

const RULES =
  'Do not add other numbers, places, times or dates, and do not describe how strong the storm is. No emojis, no Markdown, no brackets.'

export function buildDraftPrompt(sheet: FactSheet, area: string, household: Household): string {
  const place = sheet.barangays[0] ? `${area}, ${sheet.barangays[0]}` : area
  const lines = outline(sheet, area, household)
  return [
    `Write a typhoon alert for ${household.audience} in ${place}. ${ONE_EACH} You may reword these sentences a little, but keep every name, number and time exactly as written:`,
    ...fielded(lines),
    RULES,
  ].join('\n')
}

/** Problems a word-level edit can't fix: the shape, a missing fact, the time's meaning. */
const isStructural = (i: Issue) =>
  i.rule === 'missing' || (i.rule === 'plain' && (i.subject === 'sentences' || i.subject === 'words')) || i.subject === 'landfall'

/**
 * The retry: the failed draft back, with one concrete edit per problem. A
 * small on-device model follows "Remove “today”" far better than the whole
 * prompt again, and the shorter prompt runs faster on the laptop. When the
 * shape is wrong (too long, a fact missing, the time on the wrong event), it
 * gets the outline, field by field, instead of "use at most 3 sentences".
 */
export function buildRetryPrompt(draft: string, issues: Issue[], sheet: FactSheet, area: string, household: Household): string {
  const structural = issues.some(isStructural)
  const edits = editsFor(structural ? issues.filter((i) => !isStructural(i)) : issues, sheet, area, draft)
  const lines = outline(sheet, area, household)
  return [
    'Here is a typhoon alert:',
    draft.trim(),
    '',
    ...(structural
      ? [
          'Rewrite it as these sentences, keeping every name, number and time exactly as written:',
          ...fielded(lines),
          ...(edits.length ? ['Also make these changes:', ...edits.map((e) => `- ${e}`)] : []),
        ]
      : ['Rewrite it with these changes, and keep everything else the same:', ...edits.map((e) => `- ${e}`)]),
    ONE_EACH,
  ].join('\n')
}
