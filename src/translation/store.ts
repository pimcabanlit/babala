/**
 * Publishing translations to Firestore and watching what is published. Only
 * translationWrites() in record.ts makes the writes, after the checker passes
 * the exact text against the saved English alert.
 */
import { collection, doc, limit, onSnapshot, query, serverTimestamp, writeBatch, type Firestore, type Unsubscribe } from 'firebase/firestore'
import { RESIDENT_ALERTS } from '../alerts/residentCopy'
import { LEDGER } from '../ledger/record'
import { PACK_LIMIT } from '../resident/store'
import { readPublishedTranslations, type PublishedTranslations, type TranslationWrites } from './record'

/**
 * Publishes a translation on the alert's resident copy and writes its
 * `translated` ledger entry, in one batch. Only that language changes on the
 * copy. Offline, the batch waits on the laptop and the promise settles when it
 * uploads. firestore.rules refuses one write without the other, a copy that
 * isn't the current approved alert, and any other change to the copy.
 */
export function publishTranslation(db: Firestore, uid: string, writes: TranslationWrites): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, RESIDENT_ALERTS, writes.alertId), { [`translations.${writes.lang}`]: writes.translation })
  batch.set(doc(db, LEDGER, writes.ledgerId), { ...writes.entry, by: uid, at: serverTimestamp() })
  return batch.commit()
}

/** Calls back with the translations published on every resident copy now, and again on each change. */
export function watchPublishedTranslations(
  db: Firestore,
  onTranslations: (byAlert: Map<string, PublishedTranslations>) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    // The rules allow a list of resident copies only with this limit.
    query(collection(db, RESIDENT_ALERTS), limit(PACK_LIMIT)),
    { includeMetadataChanges: true },
    (snap) => {
      const byAlert = new Map<string, PublishedTranslations>()
      for (const d of snap.docs) byAlert.set(d.id, readPublishedTranslations(d.data(), d.metadata.hasPendingWrites))
      onTranslations(byAlert)
    },
    onError,
  )
}
