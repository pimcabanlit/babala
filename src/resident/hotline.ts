import { extractFigures, normalizePhone } from '../checker/figures'

/**
 * The phone numbers in the approved alert, as written there, for the
 * resident's "Need help?" card. Read with the checker's own phone matcher, so
 * the card shows exactly the number the checker matched against the bulletin
 * and adds no number of its own. Each number once, in the order it appears.
 */
export function hotlineNumbers(text: string): string[] {
  const seen = new Set<string>()
  const numbers: string[] = []
  for (const f of extractFigures(text)) {
    if (f.kind !== 'phone') continue
    const digits = normalizePhone(f.span.text)
    if (seen.has(digits)) continue
    seen.add(digits)
    numbers.push(f.span.text.trim())
  }
  return numbers
}
