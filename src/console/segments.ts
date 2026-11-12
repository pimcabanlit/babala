import type { Issue } from '../checker'

export type Segment = { text: string; issue?: Issue }

/**
 * Splits a draft into plain and flagged parts for highlighting. Issues without
 * a place in the text (such as "missing the hotline") are listed separately by
 * the caller; overlapping spans keep the first one.
 */
export function segments(text: string, issues: Issue[]): Segment[] {
  const spanned = issues
    .filter((i) => i.span && i.span.end > i.span.start && i.span.end <= text.length)
    .sort((a, b) => a.span!.start - b.span!.start)
  const out: Segment[] = []
  let at = 0
  for (const issue of spanned) {
    const { start, end } = issue.span!
    if (start < at) continue
    if (start > at) out.push({ text: text.slice(at, start) })
    out.push({ text: text.slice(start, end), issue })
    at = end
  }
  if (at < text.length) out.push({ text: text.slice(at) })
  return out
}

/** Problems in reading order, then the ones with no place in the text (missing facts, length). */
export function inReadingOrder(issues: Issue[]): Issue[] {
  const placed = issues.filter((i) => i.span).sort((a, b) => a.span!.start - b.span!.start)
  return [...placed, ...issues.filter((i) => !i.span)]
}
