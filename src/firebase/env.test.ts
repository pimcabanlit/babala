import { describe, expect, it } from 'vitest'
import { REQUIRED_ENV_KEYS, appCheckDebugSetting, readFirebaseEnv, wantsEmulators } from './env'

// Fake, obviously non-real values: never put real config in tests.
const complete = Object.fromEntries(REQUIRED_ENV_KEYS.map((k) => [k, `test-${k}`]))

describe('readFirebaseEnv', () => {
  it('builds the Firebase config and site key when every value is set', () => {
    const env = readFirebaseEnv(complete)
    expect(env).toEqual({
      ok: true,
      firebaseConfig: {
        apiKey: 'test-VITE_FIREBASE_API_KEY',
        authDomain: 'test-VITE_FIREBASE_AUTH_DOMAIN',
        projectId: 'test-VITE_FIREBASE_PROJECT_ID',
        storageBucket: 'test-VITE_FIREBASE_STORAGE_BUCKET',
        messagingSenderId: 'test-VITE_FIREBASE_MESSAGING_SENDER_ID',
        appId: 'test-VITE_FIREBASE_APP_ID',
      },
      recaptchaSiteKey: 'test-VITE_RECAPTCHA_ENTERPRISE_SITE_KEY',
    })
  })

  it('lists every missing or blank value instead of starting half-configured', () => {
    const env = readFirebaseEnv({ ...complete, VITE_FIREBASE_APP_ID: '  ', VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: undefined })
    expect(env).toEqual({ ok: false, missing: ['VITE_FIREBASE_APP_ID', 'VITE_RECAPTCHA_ENTERPRISE_SITE_KEY'] })
  })

  it('reports all keys missing for an empty env, as on a fresh clone', () => {
    expect(readFirebaseEnv({})).toEqual({ ok: false, missing: [...REQUIRED_ENV_KEYS] })
  })
})

describe('appCheckDebugSetting', () => {
  it('is off in production builds, even if a token is set', () => {
    expect(appCheckDebugSetting({ DEV: false, VITE_APPCHECK_DEBUG_TOKEN: 'abc' })).toBeUndefined()
  })

  it('uses the token from .env.local in development', () => {
    expect(appCheckDebugSetting({ DEV: true, VITE_APPCHECK_DEBUG_TOKEN: ' abc ' })).toBe('abc')
  })

  it('asks the SDK to print a new token in development when none is set', () => {
    expect(appCheckDebugSetting({ DEV: true, VITE_APPCHECK_DEBUG_TOKEN: '' })).toBe(true)
  })
})

describe('wantsEmulators', () => {
  it('is on in development when .env.local asks for it', () => {
    expect(wantsEmulators({ DEV: true, VITE_FIREBASE_EMULATORS: 'true' })).toBe(true)
  })

  it('is off in production builds, even if .env.local asks for it', () => {
    expect(wantsEmulators({ DEV: false, VITE_FIREBASE_EMULATORS: 'true' })).toBe(false)
  })

  it('is off in development unless the value is exactly "true"', () => {
    expect(wantsEmulators({ DEV: true, VITE_FIREBASE_EMULATORS: '1' })).toBe(false)
    expect(wantsEmulators({ DEV: true })).toBe(false)
  })
})
