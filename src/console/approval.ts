import { InferenceSource } from '../ai'
import type { AlertSource } from '../alerts/record'
import type { Draft } from './useDrafts'

/**
 * Which model wrote the draft's text: the last attempt that finished with
 * text. "none" when no model did, i.e. the officer typed the alert.
 */
export function writtenBy(draft: Draft): AlertSource {
  const last = draft.attempts.findLast((a) => a.endedMs !== undefined && !a.error && !a.abandoned && a.text.trim() !== '')
  if (!last) return 'none'
  if (last.source === InferenceSource.ON_DEVICE) return 'on_device'
  if (last.source === InferenceSource.IN_CLOUD) return 'in_cloud'
  return 'unknown'
}
