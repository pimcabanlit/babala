/**
 * Rule 1 (figures match): find every time, date, signal number, phone number
 * and other number, in one normalized form so different spellings compare equal.
 */
import { mask } from './text'
import type { Span } from './types'

export type FigureKind = 'time' | 'date' | 'signal' | 'phone' | 'number'

export type Figure = { kind: FigureKind; value: string; span: Span }

const pad = (n: number) => String(n).padStart(2, '0')

/** "HH:MM" from an hour and minute, or undefined if out of range. */
function hhmm(hour: number, minute: number): string | undefined {
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return undefined
  return `${pad(hour)}:${pad(minute)}`
}

function from12h(hour: number, minute: number, pm: boolean): string | undefined {
  if (hour < 1 || hour > 12) return undefined
  const h = (hour % 12) + (pm ? 12 : 0)
  return hhmm(h, minute)
}

/** Normalizes a time like "6 PM", "6:00 p.m.", "18:00" or "1800H" to "18:00". */
export function normalizeTime(text: string): string | undefined {
  const found = extractFigures(text).find((f) => f.kind === 'time')
  return found?.value
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTH = '(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'

function monthDay(month: string, day: number): string | undefined {
  // "Signal No. 2 may be raised": lowercase "may" is a verb, not a month.
  if (month.toLowerCase() === 'may' && month !== 'May' && month !== 'MAY') return undefined
  const m = MONTHS.indexOf(month.slice(0, 3).toLowerCase())
  if (m < 0 || day < 1 || day > 31) return undefined
  return `${pad(m + 1)}-${pad(day)}`
}

/** Normalizes a date like "Nov 14", "November 14, 2026" or "14 November" to "11-14". */
export function normalizeDate(text: string): string | undefined {
  return extractFigures(text).find((f) => f.kind === 'date')?.value
}

/** Phone numbers compare by digits; "+63 917…" equals "0917…". */
export function normalizePhone(text: string): string {
  const digits = text.replace(/\D/g, '')
  return digits.length === 12 && digits.startsWith('63') ? `0${digits.slice(2)}` : digits
}

/** Spelled-out hours and signal numbers: "six PM", "Signal No. Three". */
const NUMBER_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
const HOUR = `(\\d{1,2}|${NUMBER_WORDS.join('|')})`

/** Spanish-derived hours in Filipino and Cebuano: "alas-sais" is 6 o'clock. */
const ALAS_WORDS: Record<string, number> = {
  uno: 1, una: 1, dos: 2, tres: 3, kwatro: 4, kuwatro: 4, singko: 5, sais: 6, siyete: 7, syete: 7,
  otso: 8, nuwebe: 9, diyes: 10, dyes: 10, onse: 11, dose: 12,
}
const ALAS_HOUR = `(\\d{1,2}|${Object.keys(ALAS_WORDS).join('|')})`

/** 6, "six" or "sais" as a number. */
function toNumber(text: string): number {
  const lower = text.toLowerCase()
  const word = NUMBER_WORDS.indexOf(lower)
  if (word >= 0) return word + 1
  return ALAS_WORDS[lower] ?? Number(text)
}

type Matcher = { kind: FigureKind; pattern: RegExp; value: (m: RegExpMatchArray) => string | undefined }

/** Filipino and Cebuano day periods: morning, noon, afternoon, evening. */
const PERIOD_PM: Record<string, boolean | 'noon'> = {
  umaga: false,
  buntag: false,
  madaling: false,
  tanghali: 'noon',
  udto: 'noon',
  hapon: true,
  gabi: true,
  gabii: true,
}

// Order matters: earlier matchers claim their text first.
const MATCHERS: Matcher[] = [
  {
    // Phone numbers: 7+ digits, allowing spaces, dashes, dots and brackets.
    kind: 'phone',
    pattern: /(?<![\d:])\+?\(?\d[\d\s().-]{5,}\d(?![\d:])/g,
    value: (m) => {
      const d = normalizePhone(m[0])
      return d.length >= 7 && /^[\d\s().+-]+$/.test(m[0]) && !/\d\.\d/.test(m[0]) ? d : undefined
    },
  },
  {
    kind: 'time',
    pattern: new RegExp(`\\b${HOUR}(?::([0-5]\\d))?\\s*([ap])(?:\\.\\s?m\\.?|m(?![a-z]))`, 'gi'),
    value: (m) => from12h(toNumber(m[1]), Number(m[2] ?? 0), m[3].toLowerCase() === 'p'),
  },
  {
    // Filipino / Cebuano: "alas-6 ng gabi", "alas-sais ng gabi", "alas 6:30 sa buntag".
    kind: 'time',
    pattern: new RegExp(
      `\\balas[\\s-]?${ALAS_HOUR}(?::([0-5]\\d))?\\s+(?:ng|sa)\\s+(umaga|buntag|madaling|tanghali|udto|hapon|gabi|gabii)\\b`,
      'gi',
    ),
    value: (m) => {
      const hour = toNumber(m[1])
      const minute = Number(m[2] ?? 0)
      const period = PERIOD_PM[m[3].toLowerCase()]
      // "alas-12 ng tanghali" is noon; "alas-1 ng tanghali" is 1 PM.
      if (period === 'noon') return from12h(hour, minute, true)
      // "alas-12 ng gabi" is midnight.
      if (period === true && hour === 12) return hhmm(0, minute)
      return from12h(hour, minute, period === true)
    },
  },
  {
    kind: 'time',
    pattern: /\b([01]?\d|2[0-3]):([0-5]\d)(?:\s*(?:H|hrs?)\b)?/g,
    value: (m) => hhmm(Number(m[1]), Number(m[2])),
  },
  {
    // Military style: "1800H", "1800 hrs".
    kind: 'time',
    pattern: /\b([01]\d|2[0-3])([0-5]\d)\s*(?:H|hrs?)\b/g,
    value: (m) => hhmm(Number(m[1]), Number(m[2])),
  },
  { kind: 'time', pattern: /\bnoon\b|\btanghaling[\s-]tapat\b/gi, value: () => '12:00' },
  { kind: 'time', pattern: /\bmidnight\b|\bhatinggabi\b/gi, value: () => '00:00' },
  {
    // "Signal No. 3", "Signal #3", "Signal Number 3", "TCWS No. 3", "Signal No. Three".
    // Before dates, so "Signal No. 2 may be raised" stays a signal.
    kind: 'signal',
    pattern: new RegExp(`\\b(?:signal|TCWS)\\s*(?:no\\.?|number|num\\.?|#)?\\s*${HOUR}\\b`, 'gi'),
    value: (m) => String(toNumber(m[1])),
  },
  {
    kind: 'date',
    pattern: new RegExp(`\\b${MONTH}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+\\d{4}\\b)?`, 'gi'),
    value: (m) => monthDay(m[1], Number(m[2])),
  },
  {
    kind: 'date',
    pattern: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}\\b(?:,?\\s+\\d{4}\\b)?`, 'gi'),
    value: (m) => monthDay(m[2], Number(m[1])),
  },
  {
    // Any other number, including one glued to a unit ("185km/h") and
    // thousands ("1,000"). A decimal uses a point, as in the Philippines.
    kind: 'number',
    pattern: /(?<![\p{L}\d])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?!\d)/gu,
    value: (m) => String(Number(m[0].replaceAll(',', ''))),
  },
]

/**
 * Every figure in the text. Spans in `ignore` (known place names such as
 * "Purok 2") are skipped, so their numbers don't count as figures.
 */
export function extractFigures(text: string, ignore: Span[] = []): Figure[] {
  let rest = mask(text, ignore)
  const figures: Figure[] = []
  for (const matcher of MATCHERS) {
    const claimed: Span[] = []
    for (const m of rest.matchAll(matcher.pattern)) {
      const value = matcher.value(m)
      if (value === undefined) continue
      const span = { start: m.index, end: m.index + m[0].length, text: text.slice(m.index, m.index + m[0].length) }
      figures.push({ kind: matcher.kind, value, span })
      claimed.push(span)
    }
    rest = mask(rest, claimed)
  }
  return figures.sort((a, b) => a.span.start - b.span.start)
}
