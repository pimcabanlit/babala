/**
 * Rule 2 (places match): every place the draft names must be a known
 * evacuation centre, purok or barangay from the fact sheet, word for word.
 */
import { findAll, inside, phrasePattern } from './text'
import type { FactSheet, Issue, Span } from './types'

/** Words that name a kind of place. Each one in a draft must sit inside a known name. */
const VENUE_WORDS = [
  'gym', 'gymnasium', 'school', 'elementary', 'hall', 'church', 'chapel', 'cathedral', 'mosque',
  'center', 'centre', 'court', 'plaza', 'stadium', 'arena', 'auditorium', 'covered court',
  'multi-purpose', 'multipurpose', 'barangay hall', 'municipal hall', 'town hall', 'capitol',
]

/**
 * Words that change which place is meant when put in front of a known name:
 * "municipal school gym" is not "school gym".
 */
const PLACE_MODIFIERS = [
  'municipal', 'barangay', 'public', 'elementary', 'national', 'central', 'main', 'town', 'city',
  'provincial', 'community', 'local', 'nearest', 'nearby', 'covered', 'new', 'old', 'other', 'another',
]

/** Titles that follow "Barangay" without naming a place. */
const BARANGAY_ROLES = /\s(?:captain|chair(?:man|person|woman)?|council|councilors?|kagawads?|officials?|tanods?|health|secretary|treasurer)$/i

export function knownPlaces(sheet: FactSheet): string[] {
  return [...sheet.evacuationCentres, ...sheet.puroks, ...sheet.barangays].filter((p) => p.trim() !== '')
}

/** Every occurrence of a known place name, longest names first so they win overlaps. */
export function findKnownPlaces(text: string, sheet: FactSheet): Span[] {
  const names = knownPlaces(sheet).sort((a, b) => b.length - a.length)
  const spans: Span[] = []
  for (const name of names) {
    for (const span of findAll(text, phrasePattern(name))) {
      if (!spans.some((s) => inside(span, s))) spans.push(span)
    }
  }
  return spans.sort((a, b) => a.start - b.start)
}

/** Occurrences of evacuation centre names only (for the "nothing missing" rule). */
export function findCentres(text: string, sheet: FactSheet): Span[] {
  return sheet.evacuationCentres.flatMap((name) => findAll(text, phrasePattern(name)))
}

/** A few words of context before a span, for readable messages. */
function phraseAround(text: string, span: Span): string {
  const before = text.slice(0, span.start).split(/\s+/).filter(Boolean).slice(-2).join(' ')
  return `${before} ${span.text}`.trim().replace(/^[^\p{L}\p{N}[]+/u, '')
}

export function checkPlaces(text: string, sheet: FactSheet): Issue[] {
  const known = findKnownPlaces(text, sheet)
  const issues: Issue[] = []

  // A venue word outside every known name is a place the fact sheet doesn't have.
  const venues = VENUE_WORDS.flatMap((w) => findAll(text, phrasePattern(w, { plural: true })))
  const reported: Span[] = []
  for (const venue of venues.sort((a, b) => a.start - b.start)) {
    if (known.some((k) => inside(venue, k)) || reported.some((r) => inside(venue, r) || inside(r, venue))) continue
    reported.push(venue)
    issues.push({
      rule: 'places',
      message: `“${phraseAround(text, venue)}” is not an evacuation centre in the fact sheet.`,
      span: venue,
    })
  }

  // "Purok …" and "Barangay …" must be ones the fact sheet covers.
  for (const m of text.matchAll(/\b(?:[Pp]urok|PUROK|[Bb]arangay|BARANGAY|[Bb]rgy\.?)\s+(?:\d+|\p{Lu}[\p{L}-]*)/gu)) {
    const span = { start: m.index, end: m.index + m[0].length, text: m[0] }
    // "Barangay Captain" is a person, not a place (the claim-word list covers it).
    if (BARANGAY_ROLES.test(m[0])) continue
    if (known.some((k) => inside(span, k)) || reported.some((r) => inside(r, span))) continue
    issues.push({ rule: 'places', message: `“${m[0]}” is not a purok or barangay in the fact sheet.`, span })
  }

  // A modifier in front of a known name changes the place.
  for (const k of known) {
    const before = text.slice(0, k.start).match(/(\p{L}+)\s+$/u)
    if (!before) continue
    const word = before[1].toLowerCase()
    if (!PLACE_MODIFIERS.includes(word)) continue
    const start = k.start - before[0].length
    issues.push({
      rule: 'places',
      message: `“${before[1]} ${k.text}” changes the place name; the fact sheet says “${k.text}”.`,
      span: { start, end: k.end, text: text.slice(start, k.end) },
    })
  }
  return issues
}
