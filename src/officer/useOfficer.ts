import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, type Auth, type User } from 'firebase/auth'
import { doc, onSnapshot, type Firestore } from 'firebase/firestore'
import { useCallback, useEffect, useState } from 'react'
import { OFFICERS, officerStatus, signInErrorText, type ListEntry, type SignedInUser } from './status'

function toSignedInUser(u: User): SignedInUser {
  return {
    uid: u.uid,
    name: u.displayName ?? '',
    email: u.email ?? '',
    google: u.providerData.some((p) => p.providerId === GoogleAuthProvider.PROVIDER_ID),
  }
}

/**
 * The signed-in user and whether they are on the officer list. The list
 * entry is watched, so adding someone in the Firebase console lets them in
 * without a reload, and the persistent cache answers when offline.
 */
export function useOfficer(auth: Auth, db: Firestore) {
  const [user, setUser] = useState<SignedInUser | null>()
  const [entry, setEntry] = useState<{ uid: string; entry: ListEntry }>()
  const [signInError, setSignInError] = useState<string>()
  const [busy, setBusy] = useState(false)

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u ? toSignedInUser(u) : null)), [auth])

  const uid = user?.google ? user.uid : undefined
  useEffect(() => {
    if (!uid) return
    return onSnapshot(
      doc(db, OFFICERS, uid),
      { includeMetadataChanges: true },
      (snap) => setEntry({ uid, entry: { exists: snap.exists(), fromCache: snap.metadata.fromCache } }),
      (err) => setEntry({ uid, entry: { error: err.message } }),
    )
  }, [db, uid])

  const signIn = useCallback(async () => {
    setSignInError(undefined)
    setBusy(true)
    try {
      await signInWithPopup(auth, new GoogleAuthProvider())
    } catch (err) {
      const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : ''
      setSignInError(signInErrorText(code, err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }, [auth])

  const leave = useCallback(async () => {
    setSignInError(undefined)
    try {
      await signOut(auth)
    } catch (err) {
      setSignInError(`Sign-out failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [auth])

  // An entry for another user (just signed out and in again) doesn't count.
  const current = entry && entry.uid === uid ? entry.entry : undefined
  return { status: officerStatus(user, current), signIn, signOut: leave, signInError, busy }
}
