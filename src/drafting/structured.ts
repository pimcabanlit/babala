/**
 * Structured output for drafts: the model fills one field per sentence and
 * code joins them into the alert. Firebase AI Logic passes the same JSON
 * schema to Gemini Nano (onDeviceParams.promptOptions.responseConstraint) and
 * to the cloud (inCloudParams.generationConfig.responseSchema), per
 * https://firebase.google.com/docs/ai-logic/hybrid/web/generate-structured-output.
 * On the laptop, Nano asked for "3 sentences" wrote 4 or 5, or numbered them;
 * three fields can only hold the shape we asked for. The checker still checks
 * the joined text: the schema shapes the answer, it doesn't vouch for it.
 */

/** Field names double as instructions to the model, in order. */
export const ALERT_FIELDS = ['signal_and_landfall', 'what_to_do_and_where_to_go', 'hotline'] as const
export type AlertField = (typeof ALERT_FIELDS)[number]

/** What goes in each field. Both models read the schema, descriptions included. */
const FIELD_DESCRIPTIONS: Record<AlertField, string> = {
  signal_and_landfall: 'One sentence: the signal number, the area, and when the storm makes landfall.',
  what_to_do_and_where_to_go: 'One sentence: what to do, and which evacuation centre to go to.',
  hotline: 'One sentence with the hotline number.',
}

/** Plain JSON schema, accepted by both the on-device and the cloud model. */
export const ALERT_SCHEMA = {
  type: 'object',
  properties: Object.fromEntries(ALERT_FIELDS.map((f) => [f, { type: 'string', description: FIELD_DESCRIPTIONS[f] }])),
  // The hotline sentence is left out when the bulletin has no hotline.
  required: ['signal_and_landfall', 'what_to_do_and_where_to_go'],
} as const

/** One sentence per field: trimmed, with a full stop if it has no end mark. */
function sentence(text: unknown): string {
  if (typeof text !== 'string') return ''
  const t = text.replace(/\s+/g, ' ').trim()
  return t === '' || /[.!?]$/.test(t) ? t : `${t}.`
}

/** The alert from a complete JSON answer, or undefined if it isn't one. */
export function alertFromJson(json: string): string | undefined {
  try {
    const value: unknown = JSON.parse(json)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
    const fields = value as Record<string, unknown>
    const text = ALERT_FIELDS.map((f) => sentence(fields[f])).filter(Boolean).join(' ')
    return text === '' ? undefined : text
  } catch {
    return undefined
  }
}

/**
 * The alert so far, from a JSON answer still streaming in, so the officer
 * watches sentences appear instead of raw JSON. Display only: the check runs
 * on the complete answer.
 */
export function previewFromPartialJson(partial: string): string {
  const parts: string[] = []
  for (const m of partial.matchAll(/"(\w+)"\s*:\s*"((?:[^"\\]|\\.)*)("?)/g)) {
    if (!(ALERT_FIELDS as readonly string[]).includes(m[1])) continue
    let value = m[2]
    try {
      value = JSON.parse(`"${value.replace(/\\$/, '')}"`) as string
    } catch {
      // Half an escape sequence: show the raw text until the next chunk.
    }
    parts.push(value.replace(/\s+/g, ' ').trim())
  }
  return parts.filter(Boolean).join(' ')
}

/** Reads a model answer: structured if it parses, otherwise the raw text for the checker to judge. */
export function readAnswer(raw: string): string {
  return alertFromJson(raw.trim()) ?? raw.trim()
}
