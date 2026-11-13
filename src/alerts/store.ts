/**
 * Saving approved alerts to Firestore and watching what is saved. Only
 * approvedAlert() in record.ts makes the alert, after the checker passes it,
 * and approvalWrites() in src/ledger/record.ts pairs it with its ledger entry.
 */
import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore'
import { LEDGER, approvalWrites, type Trail, type WithdrawalWrites } from '../ledger/record'
import { ALERTS, readSavedAlert, type Approval, type SavedAlert } from './record'
import { RESIDENT_ALERTS } from './residentCopy'

type Approved = Extract<Approval, { ok: true }>

/**
 * Saves an approved alert, its ledger entry and the copy residents read in one
 * batch, replacing the last alert for its household and area. Earlier ledger
 * entries stay.
 * Offline, the batch is kept on the laptop and the promise settles only when
 * it uploads, so callers show progress from watchSavedAlerts, not from this.
 * firestore.rules refuses the alert without its entry and the entry without
 * its alert, requires the signed-in officer as the approver, and the server's
 * time on both, and the resident copy to match the alert.
 */
export function saveApprovedAlert(db: Firestore, uid: string, approval: Approved, trail: Trail): Promise<void> {
  const writes = approvalWrites(approval, newLedgerId(db), trail)
  const at = serverTimestamp()
  const batch = writeBatch(db)
  batch.set(doc(db, ALERTS, writes.alertId), { ...writes.alert, approvedBy: uid, approvedAt: at })
  batch.set(doc(db, LEDGER, writes.ledgerId), { ...writes.entry, by: uid, at })
  batch.set(doc(db, RESIDENT_ALERTS, writes.alertId), { ...writes.copy, updatedAt: at })
  return batch.commit()
}

/** A new ledger entry ID, made on the laptop so it works offline. */
export function newLedgerId(db: Firestore): string {
  return doc(collection(db, LEDGER)).id
}

/**
 * Withdraws a saved alert: adds the withdrawal field to it, writes the
 * withdrawal's ledger entry, and replaces the resident copy with one that has
 * no text, in one batch. Nothing else on the alert changes,
 * and a new approval later replaces the whole alert. Like saving, offline it
 * waits on the laptop and the promise settles when it uploads.
 * firestore.rules refuses one write without the other, a second withdrawal,
 * and any other change to the alert.
 */
export function withdrawAlert(db: Firestore, uid: string, writes: WithdrawalWrites): Promise<void> {
  const at = serverTimestamp()
  const batch = writeBatch(db)
  batch.update(doc(db, ALERTS, writes.alertId), { withdrawal: { ...writes.withdrawal, by: uid, at } })
  batch.set(doc(db, LEDGER, writes.ledgerId), { ...writes.entry, by: uid, at })
  batch.set(doc(db, RESIDENT_ALERTS, writes.alertId), { ...writes.copy, updatedAt: at })
  return batch.commit()
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
        const w: unknown = data.withdrawal
        const withdrawnAt = typeof w === 'object' && w !== null && 'at' in w && w.at instanceof Timestamp ? w.at.toDate() : undefined
        const saved = readSavedAlert(d.id, data, approvedAt, d.metadata.hasPendingWrites, withdrawnAt)
        if (saved) byId.set(d.id, saved)
        else unreadable.push(d.id)
      }
      onAlerts({ byId, unreadable })
    },
    onError,
  )
}
