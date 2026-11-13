import { describe, expect, it } from 'vitest'
import { officerStatus, signInErrorText, signInMethod, type SignedInUser } from './status'

const user: SignedInUser = { uid: 'officer-1', name: 'Test Officer', email: 'officer@example.com', method: 'google' }
const testOfficer: SignedInUser = { uid: 'judge-1', name: '', email: 'test-officer@example.com', method: 'password' }

describe('officerStatus', () => {
  it('is starting while Firebase restores the session', () => {
    expect(officerStatus(undefined, undefined)).toEqual({ kind: 'starting' })
  })

  it('is signed out with no user', () => {
    expect(officerStatus(null, undefined)).toEqual({ kind: 'signed-out' })
  })

  it('treats an anonymous resident as signed out, since officers sign in with Google', () => {
    expect(officerStatus({ ...user, method: 'other' }, { exists: true, fromCache: false })).toEqual({ kind: 'signed-out' })
  })

  it('lets the email and password test officer in when the list has them', () => {
    expect(officerStatus(testOfficer, { exists: true, fromCache: false })).toEqual({ kind: 'officer', user: testOfficer })
  })

  it('keeps an email and password user who is not on the list out', () => {
    expect(officerStatus(testOfficer, { exists: false, fromCache: false })).toEqual({
      kind: 'not-officer',
      user: testOfficer,
    })
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

describe('signInMethod', () => {
  it('is google for a Google account', () => {
    expect(signInMethod(['google.com'])).toBe('google')
  })

  it('is password for an email and password account', () => {
    expect(signInMethod(['password'])).toBe('password')
  })

  it('is google when an account has both, since either passes the rules', () => {
    expect(signInMethod(['password', 'google.com'])).toBe('google')
  })

  it('is other for an anonymous resident, who has no linked provider', () => {
    expect(signInMethod([])).toBe('other')
  })

  it('is other for a provider officers never use', () => {
    expect(signInMethod(['phone'])).toBe('other')
  })
})

describe('signInErrorText', () => {
  it('says nothing when the officer closes the Google window', () => {
    expect(signInErrorText('google', 'auth/popup-closed-by-user', 'closed')).toBeUndefined()
  })

  it('explains a blocked pop-up', () => {
    expect(signInErrorText('google', 'auth/popup-blocked', 'blocked')).toContain('Allow pop-ups')
  })

  it('says sign-in needs a connection when offline', () => {
    expect(signInErrorText('password', 'auth/network-request-failed', 'network')).toContain('needs a connection')
  })

  it('names Google sign-in when Google is turned off', () => {
    expect(signInErrorText('google', 'auth/operation-not-allowed', 'off')).toContain('Google sign-in is turned off')
  })

  it('names email and password sign-in when that is turned off', () => {
    expect(signInErrorText('password', 'auth/operation-not-allowed', 'off')).toContain(
      'Email and password sign-in is turned off',
    )
  })

  it('points a judge back to the testing instructions after a wrong email or password', () => {
    expect(signInErrorText('password', 'auth/invalid-credential', 'bad')).toContain('testing instructions')
  })

  it('does not blame a typed password when a Google sign-in has a bad credential', () => {
    expect(signInErrorText('google', 'auth/invalid-credential', 'Bad token')).toBe('Sign-in failed: Bad token')
  })

  it('asks the user to wait after too many attempts', () => {
    expect(signInErrorText('password', 'auth/too-many-requests', 'blocked')).toContain('Wait a few minutes')
  })

  it('passes on any other error’s message', () => {
    expect(signInErrorText('google', 'auth/internal-error', 'Something broke')).toBe('Sign-in failed: Something broke')
  })
})
