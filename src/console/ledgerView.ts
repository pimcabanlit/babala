/**
 * What the ledger section says about an entry, as plain functions so the
 * wording is tested without a browser.
 */
import type { AlertSource, SavedAlert } from '../alerts/record'
import type { LedgerDraft, LedgerEntry } from '../ledger/record'

/**
 * Whether this entry is what the alert says now: "current" (for a withdrawal,
 * the alert is still withdrawn), "withdrawn" (an approval whose alert was then
 * withdrawn), "replaced" by a later approval, or "unknown" while the saved
 * alerts haven't loaded or the alert isn't among them.
 */
export type EntryStatus = 'current' | 'withdrawn' | 'replaced' | 'unknown'

export function entryStatus(entry: LedgerEntry, saved: ReadonlyMap<string, SavedAlert> | undefined): EntryStatus {
  const alert = saved?.get(entry.alertId)
  if (!alert) return 'unknown'
  if (entry.kind === 'withdrawn') return alert.withdrawn?.ledgerId === entry.id ? 'current' : 'replaced'
  if (alert.ledgerId !== entry.id) return 'replaced'
  return alert.withdrawn ? 'withdrawn' : 'current'
}

/**
 * The approver, without a name or email: "you" for the signed-in officer,
 * otherwise the start of their user ID, enough to tell officers apart.
 */
export function approverLabel(by: string, uid: string): string {
  return by === uid ? 'you' : `another officer (ID ${by.slice(0, 6)}…)`
}

/** Who wrote the approved text, in words. */
export function writerLabel(source: AlertSource, cloudModel: string): string {
  switch (source) {
    case 'on_device':
      return 'Gemini Nano on the laptop'
    case 'in_cloud':
      return `the cloud (${cloudModel || 'model not recorded'})`
    case 'none':
      return 'the officer, by hand'
    case 'unknown':
      return 'a model the SDK didn’t name'
  }
}

/** One line for a model call: round, kind, model, time and how it ended. */
export function draftLine(d: LedgerDraft, cloudModel: string): string {
  const kind = d.retry ? 'retry with an edit per problem' : 'draft'
  const model =
    d.source === 'on_device'
      ? 'Gemini Nano on the laptop'
      : d.source === 'in_cloud'
        ? `cloud, ${cloudModel || 'model not recorded'}`
        : d.route === 'only_in_cloud'
          ? 'cloud'
          : 'laptop or cloud'
  const time = `${(d.totalMs / 1000).toFixed(1)} s`
  const outcome =
    d.outcome === 'passed'
      ? 'passed the checker'
      : d.outcome === 'failed'
        ? `failed the checker (${d.issues.length} problem${d.issues.length === 1 ? '' : 's'})`
        : d.outcome === 'error'
          ? `error: ${d.error}`
          : 'stopped waiting, moved to the cloud'
  return `Round ${d.round} · ${kind} · ${model} · ${time} · ${outcome}`
}
