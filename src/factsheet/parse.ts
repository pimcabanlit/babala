/**
 * Bulletin to fact sheet, in plain code (no AI), for the demo bulletin format.
 * The officer confirms every fact before drafting, so a fact this misses is
 * filled in by hand, never guessed by a model.
 */
import { extractFigures } from '../checker'
import type { FactSheet, Span } from '../checker'

export type ParsedBulletin = {
  sheet: FactSheet
  /** Facts the parser couldn't find, for the officer to fill in. */
  notFound: string[]
}

/** Splits into sentences without breaking "Signal No. 3" or "Brgy. Halimbawa". */
export function sentences(text: string): string[] {
  return text
    .split(/\n+|(?<!\b(?:No|Nos|Brgy|St|Sto|Sta|Mt|Dr|[ap]\.m))[.!?]+\s+(?=\p{Lu})/u)
    .map((s) => s.trim())
    .filter(Boolean)
}

const unique = (items: string[]) => [...new Set(items)]

/** "Purok 1, Purok 2 and Purok Ilaya" → three names. */
function splitList(text: string, joiners: RegExp): string[] {
  return text
    .split(joiners)
    .map((s) => s.trim().replace(/^the\s+/i, '').replace(/[.;:]+$/, '').trim())
    .filter(Boolean)
}

const STORM = /\b((?:Super\s+)?Typhoon|(?:Severe\s+)?Tropical\s+Storm|Tropical\s+Depression)\s+(\p{Lu}[\p{L}-]+)/u
const PUROK = /\bPurok\s+(?:\d+|\p{Lu}[\p{L}-]*)/gu
const BARANGAY = /\b(?:Barangay|Brgy\.?)\s+\p{Lu}[\p{L}-]*/gu
const HOTLINE = /\bhotline\b[^\d+]*(\+?\(?\d[\d\s().-]{5,}\d)/i

/**
 * Words that end a signal instead of raising it: "Signal No. 1 has been
 * lifted over Purok Baybay" names an area that is no longer under a signal.
 */
export const LIFTED = /\b(?:lift(?:ed|s|ing)?|lowered|cancell?ed|discontinued|terminated|no\s+longer)\b/i

export function parseBulletin(text: string): ParsedBulletin {
  const all = sentences(text)

  const stormName = text.match(STORM)?.[0].replace(/\s+/g, ' ') ?? ''

  const signals: FactSheet['signals'] = []
  for (const s of all) {
    const signal = extractFigures(s).find((f) => f.kind === 'signal')
    const over = s.match(/\b(?:over|for|in)\s+(.+)$/i)
    if (!signal || !over || LIFTED.test(s)) continue
    const areas = splitList(over[1].replace(/\s+of\s+(?:Barangay|Brgy\.?)\s+.*$/i, ''), /,\s*(?:and\s+)?|\s+and\s+/)
    for (const area of areas) signals.push({ area, signal: Number(signal.value) })
  }

  let landfallTime = ''
  let landfallDate: string | undefined
  const landfall = all.find((s) => /landfall/i.test(s))
  if (landfall) {
    const figures = extractFigures(landfall)
    landfallTime = figures.find((f) => f.kind === 'time')?.value ?? ''
    landfallDate = figures.find((f) => f.kind === 'date')?.span.text
  }

  const centreSentence = all.find((s) => /\bevacuat\w*\s+to\b/i.test(s))
  const evacuationCentres = centreSentence
    ? splitList(centreSentence.replace(/^.*?\bevacuat\w*\s+to\s+/i, ''), /,\s*(?:or\s+|and\s+)?|\s+or\s+|\s+and\s+/)
    : []

  const hotline = text.match(HOTLINE)?.[1].trim() ?? ''
  const { puroks, barangays, otherFigures } = namedFacts(text, signals, evacuationCentres)

  const sheet: FactSheet = {
    stormName,
    signals,
    landfallTime,
    ...(landfallDate ? { landfallDate } : {}),
    evacuationCentres,
    puroks,
    barangays,
    hotline,
    otherFigures,
    bulletinText: text,
  }
  const notFound = [
    stormName ? '' : 'storm name',
    signals.length ? '' : 'signal numbers',
    landfallTime ? '' : 'landfall time',
    evacuationCentres.length ? '' : 'evacuation centres',
    hotline ? '' : 'hotline',
  ].filter(Boolean)
  return { sheet, notFound }
}

/**
 * The facts plain code reads the same way from any bulletin, once the signals
 * and evacuation centres are known: every purok and barangay it names, and
 * every other number outside those names (wind speed, surge height), which
 * drafts may use. The cloud reading (cloud.ts) uses this too.
 */
export function namedFacts(
  text: string,
  signals: FactSheet['signals'],
  evacuationCentres: string[],
): Pick<FactSheet, 'puroks' | 'barangays' | 'otherFigures'> {
  const puroks = unique([
    ...signals.map((s) => s.area).filter((a) => /^Purok\s/.test(a)),
    ...[...text.matchAll(PUROK)].map((m) => m[0].replace(/\s+/g, ' ')),
  ])
  const barangays = unique([...text.matchAll(BARANGAY)].map((m) => m[0].replace(/\s+/g, ' '))).filter(
    // "Barangay Hall" is a centre, not a barangay.
    (b) => !evacuationCentres.some((c) => c.toLowerCase().startsWith(b.toLowerCase())),
  )

  // Every other number in the bulletin (wind speed, surge height) is allowed in drafts.
  const names = [...puroks, ...barangays, ...evacuationCentres]
  const ignore: Span[] = names.flatMap((n) => {
    const spans: Span[] = []
    let i = text.indexOf(n)
    while (i >= 0) {
      spans.push({ start: i, end: i + n.length, text: n })
      i = text.indexOf(n, i + n.length)
    }
    return spans
  })
  const otherFigures = unique(
    extractFigures(text, ignore)
      .filter((f) => f.kind === 'number')
      .map((f) => f.value),
  ).map(Number)
  return { puroks, barangays, otherFigures }
}
