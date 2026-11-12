import type { FirebaseOptions } from 'firebase/app'

/** The Vite env variables Babala needs, all set in .env.local (never committed). */
export const REQUIRED_ENV_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'VITE_RECAPTCHA_ENTERPRISE_SITE_KEY',
] as const

export type EnvSource = Partial<Record<string, string | boolean | undefined>>

export type FirebaseEnv =
  | { ok: true; firebaseConfig: FirebaseOptions; recaptchaSiteKey: string }
  | { ok: false; missing: string[] }

/** Reads and checks the Firebase settings. Pure, so it can be unit tested. */
export function readFirebaseEnv(env: EnvSource): FirebaseEnv {
  const value = (key: string) => {
    const v = env[key]
    return typeof v === 'string' ? v.trim() : ''
  }
  const missing = REQUIRED_ENV_KEYS.filter((key) => value(key) === '')
  if (missing.length > 0) return { ok: false, missing }
  return {
    ok: true,
    firebaseConfig: {
      apiKey: value('VITE_FIREBASE_API_KEY'),
      authDomain: value('VITE_FIREBASE_AUTH_DOMAIN'),
      projectId: value('VITE_FIREBASE_PROJECT_ID'),
      storageBucket: value('VITE_FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: value('VITE_FIREBASE_MESSAGING_SENDER_ID'),
      appId: value('VITE_FIREBASE_APP_ID'),
    },
    recaptchaSiteKey: value('VITE_RECAPTCHA_ENTERPRISE_SITE_KEY'),
  }
}

/**
 * The App Check debug setting for local development: the token from .env.local
 * if there is one, otherwise `true` so the SDK prints a new token to the console
 * for you to register. Never used in production builds.
 */
export function appCheckDebugSetting(env: EnvSource): string | true | undefined {
  if (env.DEV !== true) return undefined
  const token = env.VITE_APPCHECK_DEBUG_TOKEN
  return typeof token === 'string' && token.trim() !== '' ? token.trim() : true
}

/** Where `npm run emulators` serves Auth and Firestore (the ports in firebase.json). */
export const EMULATORS = {
  auth: 'http://127.0.0.1:9099',
  firestore: { host: '127.0.0.1', port: 8080 },
} as const

/**
 * Whether to use the local Auth and Firestore emulators instead of the real
 * project: only in development, and only when .env.local asks for it, so a
 * production build always talks to the real project.
 */
export function wantsEmulators(env: EnvSource): boolean {
  return env.DEV === true && env.VITE_FIREBASE_EMULATORS === 'true'
}
