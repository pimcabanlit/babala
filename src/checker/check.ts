/**
 * The checker: no alert reaches a resident unless it passes every rule here
 * and an officer approves it (build plan, "The checker"). Deterministic code,
 * never a model: a model never vouches for its own output.
 */
import { extractFigures, normalizeDate, normalizePhone, type Figure } from './figures'
import { checkPlaces, findCentres, findKnownPlaces, knownPlaces } from './places'
import { checkAddedClaims, checkPlaceholders, checkPlain } from './rules'
import { findAll, mask, phrasePattern } from './text'
import type { CheckOptions, CheckResult, FactSheet, Issue, RequiredFact, Span } from './types'

export const DEFAULT_REQUIRED: RequiredFact[] = ['signal', 'time', 'place', 'hotline']
export const DEFAULT_MAX_SENTENCES = 3
export const DEFAULT_MAX_WORDS = 60

/** The figures the fact sheet allows, by kind. */
function allowedFigures(sheet: FactSheet): Record<Figure['kind'], Set<string>> {
  const date = sheet.landfallDate ? normalizeDate(sheet.landfallDate) : undefined
  return {
    time: new Set([sheet.landfallTime]),
    date: new Set(date ? [date] : []),
    signal: new Set(sheet.signals.map((s) => String(s.signal))),
    phone: new Set([normalizePhone(sheet.hotline)]),
    number: new Set((sheet.otherFigures ?? []).map(String)),
  }
}

const KIND_LABEL: Record<Figure['kind'], string> = {
  time: 'Time',
  date: 'Date',
  signal: 'Signal number',
  phone: 'Phone number',
  number: 'Number',
}

/** Rule 1: every figure in the draft is in the fact sheet. */
function checkFigures(figures: Figure[], sheet: FactSheet): Issue[] {
  const allowed = allowedFigures(sheet)
  const hotline = normalizePhone(sheet.hotline)
  return figures
    .filter((f) => !allowed[f.kind].has(f.value))
    // A short hotline such as "911" reads as a plain number.
    .filter((f) => !(f.kind === 'number' && f.value === hotline))
    .map((f) => ({
      rule: 'figures' as const,
      message: `${KIND_LABEL[f.kind]} “${f.span.text}” is not in the fact sheet.`,
      span: f.span,
    }))
}

/** Rule 3: the facts this household type's alert must include. */
function checkMissing(text: string, figures: Figure[], sheet: FactSheet, options: CheckOptions): Issue[] {
  const required = options.required ?? DEFAULT_REQUIRED
  const issues: Issue[] = []
  const has = (kind: Figure['kind'], value: string) => figures.some((f) => f.kind === kind && f.value === value)

  if (required.includes('signal')) {
    const areaSignal = options.area ? sheet.signals.find((s) => s.area === options.area)?.signal : undefined
    const ok = areaSignal !== undefined ? has('signal', String(areaSignal)) : sheet.signals.some((s) => has('signal', String(s.signal)))
    if (!ok)
      issues.push({
        rule: 'missing',
        message:
          areaSignal !== undefined
            ? `Missing the signal number for ${options.area} (Signal No. ${areaSignal}).`
            : 'Missing the signal number.',
      })
  }
  if (required.includes('time') && !has('time', sheet.landfallTime))
    issues.push({ rule: 'missing', message: `Missing the landfall time (${sheet.landfallTime}).` })
  if (required.includes('place') && findCentres(text, sheet).length === 0)
    issues.push({ rule: 'missing', message: 'Missing where to go: name an evacuation centre from the fact sheet.' })
  // A bulletin without a hotline can't require one.
  if (required.includes('hotline') && sheet.hotline.trim() !== '') {
    const hotline = normalizePhone(sheet.hotline)
    if (!figures.some((f) => (f.kind === 'phone' || f.kind === 'number') && f.value === hotline))
      issues.push({ rule: 'missing', message: `Missing the hotline (${sheet.hotline}).` })
  }
  return issues
}

/**
 * Spans whose digits name a place, not a figure: known names and any
 * "Purok 5" (an unknown purok is reported once, by the places rule).
 */
function placeNumberSpans(text: string, sheet: FactSheet): Span[] {
  return [...findKnownPlaces(text, sheet), ...findAll(text, /\b[Pp]urok\s+\d+\b/g)]
}

function result(issues: Issue[]): CheckResult {
  return { pass: issues.length === 0, issues }
}

/** Checks an English draft against the fact sheet: rules 1 to 6. */
export function checkDraft(draft: string, sheet: FactSheet, options: CheckOptions): CheckResult {
  const placeholders = checkPlaceholders(draft)
  const figures = extractFigures(draft, placeNumberSpans(draft, sheet))
  return result([
    ...placeholders,
    ...checkFigures(figures, sheet),
    // Placeholders are reported once, not again as unknown places.
    ...checkPlaces(mask(draft, placeholders.flatMap((i) => (i.span ? [i.span] : []))), sheet),
    ...checkMissing(draft, figures, sheet, options),
    ...checkAddedClaims(draft, sheet.bulletinText, options.claimWords),
    ...checkPlain(draft, options.maxSentences ?? DEFAULT_MAX_SENTENCES, options.maxWords ?? DEFAULT_MAX_WORDS),
  ])
}

const figureKey = (f: Figure) => `${f.kind}:${f.value}`

/**
 * Rule 7: a translation keeps every figure and place name of the approved
 * English alert, unchanged. Also rejects placeholders, emojis and formatting.
 * Claim words can't be checked in other languages with the English list, which
 * is why the figures and names must match exactly.
 */
export function checkTranslation(approvedEnglish: string, translation: string, sheet: FactSheet): CheckResult {
  const issues: Issue[] = []
  const english = extractFigures(approvedEnglish, placeNumberSpans(approvedEnglish, sheet))
  const translated = extractFigures(translation, placeNumberSpans(translation, sheet))
  const englishKeys = new Set(english.map(figureKey))
  const translatedKeys = new Set(translated.map(figureKey))

  for (const f of english)
    if (!translatedKeys.has(figureKey(f)))
      issues.push({ rule: 'translation', message: `The translation lost “${f.span.text}” from the English alert.` })
  for (const f of translated)
    if (!englishKeys.has(figureKey(f)))
      issues.push({
        rule: 'translation',
        message: `“${f.span.text}” is in the translation but not in the English alert.`,
        span: f.span,
      })

  for (const name of knownPlaces(sheet)) {
    if (!phrasePattern(name).test(approvedEnglish)) continue
    if (!phrasePattern(name).test(translation))
      issues.push({ rule: 'translation', message: `The translation must keep the place name “${name}” exactly.` })
  }

  return result([
    ...checkPlaceholders(translation),
    ...issues,
    ...checkPlain(translation, 0, 0, { length: false }),
  ])
}
