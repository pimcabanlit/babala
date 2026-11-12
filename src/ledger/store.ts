/**
 * Watching the ledger. Entries are written only by saveApprovedAlert() in
 * src/alerts/store.ts, together with their alert.
 */
import { Timestamp, collection, limit, onSnapshot, orderBy, query, type Firestore, type Unsubscribe } from 'firebase/firestore'
import { LEDGER, readLedgerEntry, type LedgerEntry } from './record'

/** How many of the latest entries the console shows. */
export const LEDGER_PAGE = 50

export type LedgerView = {
  /** Newest first. */
  entries: LedgerEntry[]
  /** Documents that aren't entries this app can read. */
  unreadable: string[]
}

/** Calls back with the latest entries now, and again on each change, upload state included. */
export function watchLedger(db: Firestore, onEntries: (view: LedgerView) => void, onError: (error: Error) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, LEDGER), orderBy('at', 'desc'), limit(LEDGER_PAGE)),
    { includeMetadataChanges: true },
    (snap) => {
      const entries: LedgerEntry[] = []
      const unreadable: string[] = []
      for (const d of snap.docs) {
        const data = d.data({ serverTimestamps: 'estimate' })
        const at = data.at instanceof Timestamp ? data.at.toDate() : undefined
        const entry = readLedgerEntry(d.id, data, at, d.metadata.hasPendingWrites)
        if (entry) entries.push(entry)
        else unreadable.push(d.id)
      }
      onEntries({ entries, unreadable })
    },
    onError,
  )
}
