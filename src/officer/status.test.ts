import { describe, expect, it } from 'vitest'
import { officerStatus, signInErrorText, type SignedInUser } from './status'

const user: SignedInUser = { uid: 'officer-1', name: 'Test Officer', email: 'officer@example.com', google: true }

describe('officerStatus', () => {
  it('is starting while Firebase restores the session', () => {
    expect(officerStatus(undefined, undefined)).toEqual({ kind: 'starting' })
  })

  it('is signed out with no user', () => {
    expect(officerStatus(null, undefined)).toEqual({ kind: 'signed-out' })
  })

  it('treats an anonymous resident as signed out, since officers sign in with Google', () => {
    expect(officerStatus({ ...user, google: false }, { exists: true, fromCache: false })).toEqual({ kind: 'signed-out' })
  })

  it('is checking until the officer list answers', () => {
    expect(officerStatus(user, undefined)).toEqual({ kind: 'checking', user })
  })

  it('is an officer when the list has the user, even from the offline cache', () => {
    expect(officerStatus(user, { exists: true, fromCache: true })).toEqual({ kind: 'officer', user })
  })

  it('is not an officer when the server says the list has no such user', () => {
    expect(officerStatus(user, { exists: false, fromCache: false })).toEqual({ kind: 'not-officer', user })
  })

  it('does not call a user a non-officer just because the offline cache has never seen the list', () => {
    expect(officerStatus(user, { exists: false, fromCache: true })).toEqual({ kind: 'offline', user })
  })

  it('shows why the list could not be read', () => {
    expect(officerStatus(user, { error: 'Missing or insufficient permissions.' })).toEqual({
      kind: 'error',
      user,
      message: 'Missing or insufficient permissions.',
    })
  })
})

describe('signInErrorText', () => {
  it('says nothing when the officer closes the Google window', () => {
    expect(signInErrorText('auth/popup-closed-by-user', 'closed')).toBeUndefined()
  })

  it('explains a blocked pop-up', () => {
    expect(signInErrorText('auth/popup-blocked', 'blocked')).toContain('Allow pop-ups')
  })

  it('says sign-in needs a connection when offline', () => {
    expect(signInErrorText('auth/network-request-failed', 'network')).toContain('needs a connection')
  })

  it('passes on any other error’s message', () => {
    expect(signInErrorText('auth/internal-error', 'Something broke')).toBe('Sign-in failed: Something broke')
  })
})
