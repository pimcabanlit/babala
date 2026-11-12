/** Text helpers shared by the checker rules. */
import type { Span } from './types'

/** Escapes a literal string for use inside a RegExp. */
export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * A case-insensitive pattern for a phrase with word boundaries, where any run
 * of spaces in the phrase matches any run of whitespace, and a trailing plural
 * "s" or "es" is allowed ("storm surge" matches "storm surges").
 */
export function phrasePattern(phrase: string, { plural = false } = {}): RegExp {
  const body = phrase.trim().split(/\s+/).map(escapeRegExp).join('\\s+')
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}${plural ? '(?:e?s)?' : ''}(?![\\p{L}\\p{N}])`, 'giu')
}

/** All matches of a global pattern, as spans. */
export function findAll(text: string, pattern: RegExp): Span[] {
  const spans: Span[] = []
  for (const m of text.matchAll(pattern)) {
    spans.push({ start: m.index, end: m.index + m[0].length, text: m[0] })
  }
  return spans
}

export function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end
}

export function inside(inner: Span, outer: Span): boolean {
  return inner.start >= outer.start && inner.end <= outer.end
}

/** Replaces the given spans with spaces, keeping every other offset unchanged. */
export function mask(text: string, spans: Span[]): string {
  let out = text
  for (const s of spans) out = out.slice(0, s.start) + ' '.repeat(s.end - s.start) + out.slice(s.end)
  return out
}

/** Abbreviations whose period does not end a sentence. */
const ABBREVIATIONS = /\b(?:No|Nos|Brgy|St|Sto|Sta|Mt|Gov|Engr|Dr|Hon|Sr|Jr|vs|etc|approx|e\.g|i\.e)\./gi

/** Counts sentences, ignoring abbreviations like "No." and "p.m." and decimals like "1.5". */
export function countSentences(text: string): number {
  const cleaned = text
    // "6 p.m. Evacuate now" ends a sentence; "6 p.m. at the gym" doesn't.
    .replace(/\b([aApP])\.[mM]\.(?=\s+\p{Lu}|\s*$)/gu, '$1m.')
    .replace(/\b([ap])\.m\.?/gi, '$1m')
    .replace(ABBREVIATIONS, (m) => m.replace(/\./g, ''))
    .replace(/(\d)\.(\d)/g, '$1$2')
  return cleaned
    .split(/[.!?]+(?=\s|$)/)
    .filter((part) => /\p{L}/u.test(part)).length
}

export function countWords(text: string): number {
  const t = text.trim()
  return t === '' ? 0 : t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}

/**
 * The sentence (or line) around each offset, as a span. Abbreviations such as
 * "No." and decimals don't end a sentence; offsets match the original text.
 */
export function sentenceAt(text: string, index: number): Span {
  const protectedText = text
    .replace(ABBREVIATIONS, (m) => m.replace(/\./g, '_'))
    .replace(/\b([aApP])\.[mM]\.(?!\s+\p{Lu}|\s*$)/gu, (m) => m.replace(/\./g, '_'))
    .replace(/(\d)\.(\d)/g, '$1_$2')
  let start = 0
  for (const m of protectedText.matchAll(/[.!?]+(?=\s|$)|\n/g)) {
    const end = m.index + m[0].length
    if (end > index) return { start, end, text: text.slice(start, end) }
    start = end
  }
  return { start, end: text.length, text: text.slice(start) }
}
