/**
 * Rules 4 to 6: no placeholders, no added claims, plain and short.
 */
import { countSentences, countWords, findAll, phrasePattern } from './text'
import type { Issue } from './types'

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /\[[^\]\n]*\]/g, // [School Name]
  /\{[^}\n]*\}/g, // {name}
  /<[^>\n]+>/g, // <address>
  /\b(?:TBD|TBA|TBC|N\/A)\b/g,
  /\bX{2,}\b/gi, // XXX, xx
  /_{3,}/g, // ____
  /\binsert\s+(?:\w+\s+){0,2}(?:here|name|address|date|time|number)\b/gi,
  /\blorem ipsum\b/gi,
  // Prompt wording copied into the alert (seen from the cloud model on Nov 12).
  /\b(?:tell|ask|remind) them\b|\bsay that\b/gi,
  /\((?:name|address|location|date|time|number|barangay|purok|school|phone|hotline)[^)]*\)/gi,
]

export function checkPlaceholders(text: string): Issue[] {
  const seen = new Set<number>()
  return PLACEHOLDER_PATTERNS.flatMap((p) => findAll(text, p))
    .filter((s) => (seen.has(s.start) ? false : (seen.add(s.start), true)))
    .sort((a, b) => a.start - b.start)
    .map((span) => ({ rule: 'placeholders' as const, message: `Placeholder “${span.text}” must be replaced with a real fact.`, span }))
}

/**
 * Severity, safety, timing and authority words are allowed only when the
 * bulletin itself uses them. The list comes from Remote Config.
 */
export function checkAddedClaims(text: string, bulletinText: string, claimWords: string[]): Issue[] {
  const issues: Issue[] = []
  const words = [...new Set(claimWords.map((w) => w.trim().toLowerCase()).filter(Boolean))]
    // Longer phrases first, so "super typhoon" is reported instead of a shorter overlap.
    .sort((a, b) => b.length - a.length)
  const taken: { start: number; end: number }[] = []
  for (const word of words) {
    if (phrasePattern(word, { plural: true }).test(bulletinText)) continue
    for (const span of findAll(text, phrasePattern(word, { plural: true }))) {
      if (taken.some((t) => span.start < t.end && t.start < span.end)) continue
      taken.push(span)
      issues.push({ rule: 'added-claims', message: `“${span.text}” is not in the bulletin.`, span })
    }
  }
  return issues.sort((a, b) => (a.span?.start ?? 0) - (b.span?.start ?? 0))
}

const EMOJI = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]️?/gu
const MARKDOWN = /\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|^\s*(?:#{1,6}\s|[-*+]\s|\d+\.\s)/gm

export function checkPlain(text: string, maxSentences: number, maxWords: number, { length = true } = {}): Issue[] {
  const issues: Issue[] = []
  if (length) {
    const sentences = countSentences(text)
    if (sentences > maxSentences)
      issues.push({ rule: 'plain', subject: 'sentences', message: `${sentences} sentences; the limit is ${maxSentences}.` })
    const words = countWords(text)
    if (words > maxWords) issues.push({ rule: 'plain', subject: 'words', message: `${words} words; the limit is ${maxWords}.` })
  }
  for (const span of findAll(text, EMOJI))
    issues.push({ rule: 'plain', subject: 'emoji', message: `Emoji “${span.text}” is not allowed.`, span })
  for (const span of findAll(text, MARKDOWN))
    issues.push({ rule: 'plain', subject: 'format', message: `Formatting “${span.text.trim()}” is not allowed; alerts are plain text.`, span })
  return issues
}
