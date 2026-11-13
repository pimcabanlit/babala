import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth'
import { doc, onSnapshot, type Firestore } from 'firebase/firestore'
import { useCallback, useEffect, useState } from 'react'
import { OFFICERS, officerStatus, signInErrorText, signInMethod, type ListEntry, type SignedInUser } from './status'

function toSignedInUser(u: User): SignedInUser {
  return {
    uid: u.uid,
    name: u.displayName ?? '',
    email: u.email ?? '',
    method: signInMethod(u.providerData.map((p) => p.providerId)),
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

  const uid = user && user.method !== 'other' ? user.uid : undefined
  useEffect(() => {
    if (!uid) return
    return onSnapshot(
      doc(db, OFFICERS, uid),
      { includeMetadataChanges: true },
      (snap) => setEntry({ uid, entry: { exists: snap.exists(), fromCache: snap.metadata.fromCache } }),
      (err) => setEntry({ uid, entry: { error: err.message } }),
    )
  }, [db, uid])

  const attempt = useCallback(async (method: 'google' | 'password', run: () => Promise<unknown>) => {
    setSignInError(undefined)
    setBusy(true)
    try {
      await run()
    } catch (err) {
      const code = typeof err === 'object' && err && 'code' in err ? String(err.code) : ''
      setSignInError(signInErrorText(method, code, err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }, [])

  const signIn = useCallback(
    () => attempt('google', () => signInWithPopup(auth, new GoogleAuthProvider())),
    [auth, attempt],
  )

  /** The judges' shared test officer account, made by the project owner in the Firebase console. */
  const signInAsTestOfficer = useCallback(
    (email: string, password: string) =>
      attempt('password', () => signInWithEmailAndPassword(auth, email.trim(), password)),
    [auth, attempt],
  )

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
  return { status: officerStatus(user, current), signIn, signInAsTestOfficer, signOut: leave, signInError, busy }
}
