/**
 * The checker: no alert reaches a resident unless it passes every rule here
 * and an officer approves it (docs/data-schema.md, "Checker rules"). Deterministic code,
 * never a model: a model never vouches for its own output.
 */
import { extractFigures, normalizeDate, normalizePhone, type Figure } from './figures'
import { checkPlaces, findCentres, findKnownPlaces, knownPlaces } from './places'
import { checkAddedClaims, checkPlaceholders, checkPlain } from './rules'
import { findAll, mask, overlaps, phrasePattern, sentenceAt } from './text'
import type { CheckOptions, CheckResult, FactSheet, Issue, RequiredFact, Span, TranslationOptions } from './types'

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
      subject: f.kind,
      message: `${KIND_LABEL[f.kind]} “${f.span.text}” is not in the fact sheet.`,
      span: f.span,
    }))
}

/** Words that say the time is when the storm arrives. */
export const LANDFALL_WORDS = /\b(?:landfall|make(?:s)?\s+land|hit(?:s|ting)?|strike(?:s)?|striking)\b/i

/**
 * Rule 1, the meaning of the time: the bulletin's only time is the landfall
 * time, so a draft may use it only in a sentence about landfall. "Declared at
 * 6:00 PM" or "bring food by 6:00 PM" has the right figure and the wrong fact.
 */
function checkTimeMeaning(text: string, figures: Figure[], sheet: FactSheet): Issue[] {
  return figures
    .filter((f) => f.kind === 'time' && f.value === sheet.landfallTime)
    .filter((f) => !LANDFALL_WORDS.test(sentenceAt(text, f.span.start).text))
    .map((f) => ({
      rule: 'figures' as const,
      subject: 'landfall' as const,
      message: `“${f.span.text}” is the landfall time: say it in a sentence about landfall.`,
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
        subject: 'signal',
        message:
          areaSignal !== undefined
            ? `Missing the signal number for ${options.area} (Signal No. ${areaSignal}).`
            : 'Missing the signal number.',
      })
  }
  if (required.includes('time') && !has('time', sheet.landfallTime))
    issues.push({ rule: 'missing', subject: 'time', message: `Missing the landfall time (${sheet.landfallTime}).` })
  if (required.includes('place') && findCentres(text, sheet).length === 0)
    issues.push({ rule: 'missing', subject: 'place', message: 'Missing where to go: name an evacuation centre from the fact sheet.' })
  // A bulletin without a hotline can't require one.
  if (required.includes('hotline') && sheet.hotline.trim() !== '') {
    const hotline = normalizePhone(sheet.hotline)
    if (!figures.some((f) => (f.kind === 'phone' || f.kind === 'number') && f.value === hotline))
      issues.push({ rule: 'missing', subject: 'hotline', message: `Missing the hotline (${sheet.hotline}).` })
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

/**
 * "1." at the start of a line is a list marker, reported once by the plain
 * rule as formatting. On Nov 12 it was also reported as the number “1”, and
 * the retry's "Remove “1”" took the 1 out of "Purok 1" and the hotline.
 */
const LIST_MARKERS = /^\s*\d+\.(?=\s)/gm

function result(issues: Issue[]): CheckResult {
  return { pass: issues.length === 0, issues }
}

/** Checks an English draft against the fact sheet: rules 1 to 6. */
export function checkDraft(draft: string, sheet: FactSheet, options: CheckOptions): CheckResult {
  const placeholders = checkPlaceholders(draft)
  const figures = extractFigures(draft, [...placeNumberSpans(draft, sheet), ...findAll(draft, LIST_MARKERS)])
  return result([
    ...placeholders,
    ...checkFigures(figures, sheet),
    ...checkTimeMeaning(draft, figures, sheet),
    // Placeholders are reported once, not again as unknown places.
    ...checkPlaces(mask(draft, placeholders.flatMap((i) => (i.span ? [i.span] : []))), sheet),
    ...checkMissing(draft, figures, sheet, options),
    ...checkAddedClaims(draft, sheet.bulletinText, options.claimWords),
    ...checkPlain(draft, options.maxSentences ?? DEFAULT_MAX_SENTENCES, options.maxWords ?? DEFAULT_MAX_WORDS),
  ])
}

const figureKey = (f: Figure) => `${f.kind}:${f.value}`

/** Rule 6 for translations: Filipino and Cebuano run longer than English, so more words, the same sentences. */
export const TRANSLATION_MAX_SENTENCES = 3
export const TRANSLATION_MAX_WORDS = 90

/** Rule 7, figures: the same figures as the English alert, in either direction. */
function compareFigures(english: string, translation: string, sheet: FactSheet): Issue[] {
  const issues: Issue[] = []
  const inEnglish = extractFigures(english, placeNumberSpans(english, sheet))
  const inTranslation = extractFigures(translation, placeNumberSpans(translation, sheet))
  const englishKeys = new Set(inEnglish.map(figureKey))
  const translatedKeys = new Set(inTranslation.map(figureKey))
  const lost = new Set<string>()
  for (const f of inEnglish)
    if (!translatedKeys.has(figureKey(f)) && !lost.has(figureKey(f))) {
      lost.add(figureKey(f))
      issues.push({ rule: 'translation', message: `The translation lost “${f.span.text}” from the English alert.` })
    }
  for (const f of inTranslation)
    if (!englishKeys.has(figureKey(f)))
      issues.push({ rule: 'translation', message: `“${f.span.text}” is in the translation but not in the English alert.`, span: f.span })
  return issues
}

/** A place name in one form, so "Barangay  hall" and "Barangay Hall" compare equal. */
const placeKey = (text: string) => text.toLowerCase().replace(/\s+/g, ' ')

/** Rule 7, places: the same known place names as the English alert, written exactly as the fact sheet does. */
function comparePlaces(english: string, translation: string, sheet: FactSheet): Issue[] {
  const issues: Issue[] = []
  const englishNames = new Set(findKnownPlaces(english, sheet).map((s) => placeKey(s.text)))
  const translated = findKnownPlaces(translation, sheet)
  const translatedNames = new Set(translated.map((s) => placeKey(s.text)))
  for (const name of knownPlaces(sheet))
    if (englishNames.has(placeKey(name)) && !translatedNames.has(placeKey(name)))
      issues.push({ rule: 'translation', message: `The translation must keep the place name “${name}” exactly.` })
  const added = new Set<string>()
  for (const span of translated) {
    const key = placeKey(span.text)
    if (englishNames.has(key) || added.has(key)) continue
    added.add(key)
    issues.push({ rule: 'translation', message: `“${span.text}” is in the translation but not in the English alert.`, span })
  }
  return issues
}

/**
 * Rule 7, claims: a word that adds severity, a hazard, safety, timing or
 * authority is allowed in a translation only when the approved English alert
 * says the same. English claim words (rule 5's list) must be in the English
 * alert; a Filipino or Cebuano one needs one of its English words there.
 * Longer phrases win, so "walang panganib" (no danger) is judged as itself,
 * not as "panganib" (danger).
 */
function compareClaims(english: string, translation: string, options: TranslationOptions): Issue[] {
  type Claim = { word: string; backedBy: string[]; meaning?: string; plural: boolean }
  const claims: Claim[] = [
    ...options.claimWords.map((w) => ({ word: w, backedBy: [w], plural: true })),
    ...options.translatedClaims.flatMap((c) =>
      c.words.map((w) => ({ word: w, backedBy: c.english, meaning: c.english[0], plural: false })),
    ),
  ]
    .filter((c) => c.word.trim() !== '')
    .sort((a, b) => b.word.trim().length - a.word.trim().length)
  const taken: Span[] = []
  const issues: Issue[] = []
  for (const claim of claims) {
    const backed = claim.backedBy.some((b) => b.trim() !== '' && phrasePattern(b, { plural: true }).test(english))
    for (const span of findAll(translation, phrasePattern(claim.word, { plural: claim.plural }))) {
      if (taken.some((t) => overlaps(span, t))) continue
      taken.push(span)
      if (backed) continue
      const meaning = claim.meaning ? ` (“${claim.meaning}”)` : ''
      issues.push({ rule: 'translation', message: `“${span.text}”${meaning} is not in the English alert.`, span })
    }
  }
  return issues
}

/**
 * Rule 7: a translation says what the approved English alert says, checked on
 * its own against that English text and the fact sheet, never against another
 * translation. It keeps every figure and place name, adds none, and adds no
 * claim the English doesn't make. It is also held to rules 2 (no other places,
 * including Filipino and Cebuano words for a venue), 4 (no placeholders) and 6
 * (plain and short, Latin letters only).
 */
export function checkTranslation(
  approvedEnglish: string,
  translation: string,
  sheet: FactSheet,
  options: TranslationOptions,
): CheckResult {
  const placeholders = checkPlaceholders(translation)
  const withoutPlaceholders = mask(translation, placeholders.flatMap((i) => (i.span ? [i.span] : [])))
  return result([
    ...placeholders,
    ...compareFigures(approvedEnglish, translation, sheet),
    ...comparePlaces(approvedEnglish, translation, sheet),
    // Placeholders are reported once, not again as unknown places.
    ...checkPlaces(withoutPlaceholders, sheet),
    ...compareClaims(approvedEnglish, translation, options),
    ...checkPlain(
      translation,
      options.maxSentences ?? TRANSLATION_MAX_SENTENCES,
      options.maxWords ?? TRANSLATION_MAX_WORDS,
    ),
  ])
}

/**
 * The figures and place names in an approved English alert, as written there:
 * what a translation must keep. For the translation prompt and the console.
 */
export function keptFacts(approvedEnglish: string, sheet: FactSheet): { figures: string[]; places: string[] } {
  const figures = extractFigures(approvedEnglish, placeNumberSpans(approvedEnglish, sheet)).map((f) => f.span.text)
  const places = findKnownPlaces(approvedEnglish, sheet).map((s) => s.text)
  return { figures: [...new Set(figures)], places: [...new Set(places)] }
}
