/**
 * One concrete edit for each checker problem, with the right value from the
 * fact sheet, for the retry prompt: "Change “7 PM” to “6:00 PM”."
 */
import { DEFAULT_MAX_SENTENCES, DEFAULT_MAX_WORDS, extractFigures, type FactSheet, type Issue } from '../checker'
import { to12h } from '../factsheet/form'

/** The landfall time as drafts should say it: "6:00 PM on Nov 14". */
export function whenText(sheet: FactSheet): string {
  const time = to12h(sheet.landfallTime)
  return sheet.landfallDate ? `${time} on ${sheet.landfallDate}` : time
}

function signalText(sheet: FactSheet, area: string): string | undefined {
  const signal = sheet.signals.find((s) => s.area === area)?.signal ?? sheet.signals[0]?.signal
  return signal === undefined ? undefined : `Signal No. ${signal}`
}

/** "to the gymnasium" → "gymnasium": the place words only. */
const LEADING_SMALL_WORDS = /^(?:(?:to|the|at|in|a|an|our|your|for|of|from|nearest|nearby)\s+)+/i

/** The first quoted phrase in a checker message. */
const quoted = (message: string) => message.match(/“(.+?)”/)?.[1]

/** What a placeholder most likely stood for, by its wording. */
function placeholderValue(text: string, sheet: FactSheet, area: string, centre: string): string | undefined {
  if (/school|cent(?:re|er)|gym|evacuation|shelter|hall|venue/i.test(text)) return centre
  if (/phone|hotline|contact|number/i.test(text)) return sheet.hotline || undefined
  if (/date|day/i.test(text)) return sheet.landfallDate
  if (/time|hour/i.test(text)) return to12h(sheet.landfallTime)
  if (/village|barangay|purok|town|area|community|location|place/i.test(text))
    return sheet.barangays[0] ? `${area}, ${sheet.barangays[0]}` : area
  return undefined
}

/** `centre` is the evacuation centre to name when a fix needs one (the first by default). */
export function fixFor(issue: Issue, sheet: FactSheet, area: string, centre = sheet.evacuationCentres[0]): string {
  const found = issue.span?.text ?? quoted(issue.message) ?? ''
  switch (issue.rule) {
    case 'placeholders': {
      const value = placeholderValue(found, sheet, area, centre)
      return value ? `Replace “${found}” with “${value}”.` : `Remove “${found}”.`
    }
    case 'added-claims':
      return `Remove “${found}”; the bulletin doesn’t say it.`
    case 'figures': {
      const right =
        issue.subject === 'time'
          ? to12h(sheet.landfallTime)
          : issue.subject === 'date'
            ? sheet.landfallDate
            : issue.subject === 'signal'
              ? signalText(sheet, area)
              : issue.subject === 'phone'
                ? sheet.hotline || undefined
                : undefined
      if (issue.subject === 'landfall') return `Say that ${sheet.stormName || 'the typhoon'} makes landfall at ${whenText(sheet)}.`
      return right ? `Change “${found}” to “${right}”.` : `Remove “${found}”.`
    }
    case 'places':
      if (issue.subject === 'modifier') return `Change “${found}” to “${found.replace(/^\S+\s+/, '')}”.`
      if (issue.subject === 'area') return `Remove “${found}”; this alert is for ${area}.`
      return `Replace “${(quoted(issue.message) ?? found).replace(LEADING_SMALL_WORDS, '')}” with “${centre}”.`
    case 'missing':
      if (issue.subject === 'signal') return `Add “${signalText(sheet, area)} in ${area}”.`
      if (issue.subject === 'time') return `Add when: “${whenText(sheet)}”.`
      if (issue.subject === 'place') return `Add where to go: “${sheet.evacuationCentres.join('” or “')}”.`
      if (issue.subject === 'hotline') return `Add the hotline: “${sheet.hotline}”.`
      return issue.message
    case 'plain':
      if (issue.subject === 'sentences') return `Use at most ${DEFAULT_MAX_SENTENCES} sentences.`
      if (issue.subject === 'words') return `Use at most ${DEFAULT_MAX_WORDS} words.`
      if (issue.subject === 'emoji') return `Remove the emoji “${found}”.`
      if (issue.subject === 'format') {
        const words = found.replace(/[*_`#]|^\s*[-+]\s|^\s*\d+\.\s/g, '').trim()
        return words ? `Write “${words}” as plain text, without * or # marks.` : `Remove “${found.trim()}” from the start of the line.`
      }
      return issue.message
    case 'translation':
      return issue.message
  }
}

/**
 * The words around a span, within its line and sentence: "about 25 families".
 * A bare "Remove “1”" made the cloud take every 1 out of the alert on Nov 12,
 * including "Purok 1" and the hotline.
 */
export function around(draft: string, span: { start: number; end: number }, words = 2): string {
  const before = draft.slice(0, span.start).split(/\n|[.!?;:]\s/).pop() ?? ''
  const after = draft.slice(span.end).split(/\n|[!?;:]\s|\.(?:\s|$)/)[0] ?? ''
  const head = before.split(/\s+/).filter(Boolean).slice(-words).join(' ')
  const tail = after.split(/\s+/).filter(Boolean).slice(0, words).join(' ')
  const left = head && /\s$/.test(before) ? `${head} ` : head
  const right = tail && /^\s/.test(after) ? ` ${tail}` : tail
  return `${left}${draft.slice(span.start, span.end)}${right}`
}

/**
 * The edit list for a retry, in reading order, then the missing facts and
 * length. A missing fact is left out when another edit already puts it in
 * (changing "7 PM" to "6:00 PM" also fixes "missing the landfall time").
 */
export function editsFor(issues: Issue[], sheet: FactSheet, area: string, draft: string): string[] {
  const gap = (from: number, to: number) => (to >= from ? draft.slice(from, to) : 'x')
  const placeholders = issues.filter((i) => i.rule === 'placeholders' && i.span)
  const placed = issues
    .filter((i) => i.span)
    // "[School Name] gymnasium": replacing the placeholder already names the centre.
    .filter((i) => !(i.subject === 'venue' && placeholders.some((p) => /^\s*$/.test(gap(p.span!.end, i.span!.start)))))
    .sort((a, b) => a.span!.start - b.span!.start)
  const rest = issues.filter((i) => !i.span && i.rule !== 'missing')
  // Two places to fix get two different centres, not "the gym or the gym".
  let centres = 0
  const edits = [...placed, ...rest].map((i) => {
    const centre = sheet.evacuationCentres[centres % sheet.evacuationCentres.length]
    const bare = i.rule === 'figures' && i.subject === 'number' && i.span
    const edit = bare ? `Remove “${i.span!.text}” from “${around(draft, i.span!)}”.` : fixFor(i, sheet, area, centre)
    if (edit.includes(`with “${centre}”`)) centres++
    return edit
  })
  for (const issue of issues.filter((i) => i.rule === 'missing')) {
    const value =
      issue.subject === 'signal'
        ? signalText(sheet, area)
        : issue.subject === 'time'
          ? to12h(sheet.landfallTime)
          : issue.subject === 'hotline'
            ? sheet.hotline
            : undefined
    const values = issue.subject === 'place' ? sheet.evacuationCentres : value ? [value] : []
    if (values.some((v) => edits.some((e) => e.includes(`“${v}`)))) continue
    // "Signal No. 2" for an area with Signal No. 3: change it rather than add a second one.
    const otherSignal = issue.subject === 'signal' ? extractFigures(draft).find((f) => f.kind === 'signal') : undefined
    edits.push(otherSignal && value ? `Change “${otherSignal.span.text}” to “${value}”.` : fixFor(issue, sheet, area))
  }
  return [...new Set(edits)]
}
