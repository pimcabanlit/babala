/**
 * Who may use the officer console: someone signed in with Google whose user ID
 * has a document in the `officers` collection. Only the project owner adds
 * those documents, in the Firebase console; firestore.rules lets nobody write
 * them from the app. The rules check the same thing on every save, so this
 * status only decides what the page shows.
 */

export const OFFICERS = 'officers'

export type SignedInUser = {
  uid: string
  name: string
  email: string
  /** Signed in with Google, not anonymously (residents will be anonymous). */
  google: boolean
}

/** What the officer list said about the user, or why it couldn't be read. */
export type ListEntry = { exists: boolean; fromCache: boolean } | { error: string }

export type OfficerStatus =
  | { kind: 'starting' }
  | { kind: 'signed-out' }
  | { kind: 'checking'; user: SignedInUser }
  /** Offline, and this laptop has never seen the officer list. */
  | { kind: 'offline'; user: SignedInUser }
  | { kind: 'not-officer'; user: SignedInUser }
  | { kind: 'officer'; user: SignedInUser }
  | { kind: 'error'; user: SignedInUser; message: string }

/**
 * The status from the signed-in user (undefined while Firebase restores the
 * session, null when signed out) and the officer list's answer for them.
 */
export function officerStatus(user: SignedInUser | null | undefined, entry: ListEntry | undefined): OfficerStatus {
  if (user === undefined) return { kind: 'starting' }
  if (user === null || !user.google) return { kind: 'signed-out' }
  if (entry === undefined) return { kind: 'checking', user }
  if ('error' in entry) return { kind: 'error', user, message: entry.error }
  if (entry.exists) return { kind: 'officer', user }
  // A missing document read from the cache only means this laptop hasn't seen it.
  return entry.fromCache ? { kind: 'offline', user } : { kind: 'not-officer', user }
}

/** A sign-in error in plain words, or undefined when the officer closed the window. */
export function signInErrorText(code: string, message: string): string | undefined {
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return undefined
    case 'auth/popup-blocked':
      return 'Chrome blocked the sign-in window. Allow pop-ups for this site and try again.'
    case 'auth/network-request-failed':
      return 'Signing in needs a connection. Try again when you’re online.'
    case 'auth/unauthorized-domain':
      return 'This web address isn’t allowed to sign in. Add it under Authentication > Settings > Authorized domains in the Firebase console.'
    case 'auth/operation-not-allowed':
      return 'Google sign-in is turned off for this project. Turn it on under Authentication > Sign-in method in the Firebase console.'
    default:
      return `Sign-in failed: ${message}`
  }
}
