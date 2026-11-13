/**
 * Residents' side of Firestore: anonymous sign-in, and watching the resident
 * copies of the barangay's alerts (`residentAlerts`). Residents never read
 * `alerts` or the ledger; firestore.rules refuses them.
 */
import { signInAnonymously, type Auth } from 'firebase/auth'
import { Timestamp, collection, limit, onSnapshot, query, type Firestore, type Unsubscribe } from 'firebase/firestore'
import { RESIDENT_ALERTS } from '../alerts/residentCopy'
import { readPackAlert, type Pack } from './pack'

/** The most copies one read asks for. firestore.rules refuses a list that asks for more. */
export const PACK_LIMIT = 200

/**
 * Signs the resident in anonymously, unless someone (an officer, or the same
 * resident last time) is already signed in on this browser. Residents never
 * see a sign-in screen. Offline with nobody signed in, this throws, and the
 * view shows the pack already saved on the phone.
 */
export async function signInResident(auth: Auth): Promise<void> {
  await auth.authStateReady()
  if (!auth.currentUser) await signInAnonymously(auth)
}

/**
 * Calls back with the whole pack now and on each change. `fromServer` is false
 * while Firestore answers from the phone's cache (offline, or before the
 * server replies), so the caller saves only packs that came from the server.
 */
export function watchResidentAlerts(
  db: Firestore,
  onPack: (pack: Pack, fromServer: boolean, unreadable: number) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    query(collection(db, RESIDENT_ALERTS), limit(PACK_LIMIT)),
    { includeMetadataChanges: true },
    (snap) => {
      const alerts: Pack['alerts'] = []
      let unreadable = 0
      for (const d of snap.docs) {
        const data = d.data()
        const at = data.updatedAt instanceof Timestamp ? data.updatedAt.toMillis() : null
        const alert = readPackAlert(d.id, data, at)
        if (alert) alerts.push(alert)
        else unreadable += 1
      }
      onPack({ savedAtMs: Date.now(), alerts }, !snap.metadata.fromCache, unreadable)
    },
    onError,
  )
}
