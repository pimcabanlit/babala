/**
 * Saving approved alerts to Firestore and watching what is saved. Only
 * approvedAlert() in record.ts makes the document, after the checker passes it.
 */
import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import { ALERTS, readSavedAlert, type Approval, type SavedAlert } from './record'

type Approved = Extract<Approval, { ok: true }>

/**
 * Saves an approved alert, replacing the last one for its household and area.
 * Offline, the write is kept on the laptop and the promise settles only when
 * it uploads, so callers show progress from watchSavedAlerts, not from this.
 * firestore.rules requires approvedBy to be the signed-in officer and
 * approvedAt to be the server's time.
 */
export function saveApprovedAlert(db: Firestore, uid: string, approval: Approved): Promise<void> {
  return setDoc(doc(db, ALERTS, approval.id), { ...approval.record, approvedBy: uid, approvedAt: serverTimestamp() })
}

export type SavedAlerts = {
  byId: Map<string, SavedAlert>
  /** Documents that aren't alerts this app can read, e.g. after a hand edit in the console. */
  unreadable: string[]
}

/** Calls back with every saved alert now, and again on each change, upload state included. */
export function watchSavedAlerts(
  db: Firestore,
  onAlerts: (alerts: SavedAlerts) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, ALERTS),
    { includeMetadataChanges: true },
    (snap) => {
      const byId = new Map<string, SavedAlert>()
      const unreadable: string[] = []
      for (const d of snap.docs) {
        const data = d.data({ serverTimestamps: 'estimate' })
        const approvedAt = data.approvedAt instanceof Timestamp ? data.approvedAt.toDate() : undefined
        const saved = readSavedAlert(d.id, data, approvedAt, d.metadata.hasPendingWrites)
        if (saved) byId.set(d.id, saved)
        else unreadable.push(d.id)
      }
      onAlerts({ byId, unreadable })
    },
    onError,
  )
}
