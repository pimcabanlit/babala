import { initializeApp, type FirebaseApp } from 'firebase/app'
import { ReCaptchaEnterpriseProvider, initializeAppCheck, type AppCheck } from 'firebase/app-check'
import {
  browserPopupRedirectResolver,
  connectAuthEmulator,
  getAuth,
  inMemoryPersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth'
import {
  connectFirestoreEmulator,
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'
import { EMULATORS, appCheckDebugSetting, readFirebaseEnv, wantsEmulators } from './env'
import { browserPage, retryRecaptchaScript } from './recaptchaRetry'

declare global {
  // Read by the App Check SDK before it initializes. Development only.
  var FIREBASE_APPCHECK_DEBUG_TOKEN: string | boolean | undefined
}

export type FirebaseServices =
  | { ok: true; app: FirebaseApp; appCheck: AppCheck; auth: Auth; db: Firestore; emulators: boolean }
  | { ok: false; missing: string[] }

let services: FirebaseServices | undefined

/**
 * Each setting is read by its own name, never as the whole import.meta.env:
 * Vite writes the whole object, with every VITE_ variable in .env.local, into
 * the production bundle wherever it is passed as a value.
 *
 * Starts Firebase once: App Check first, because it is enforced on AI Logic
 * (and on Firestore, docs/firebase-setup.md section 4), so Firestore's first
 * request already carries a token. If the
 * page opened with no signal, the reCAPTCHA script App Check needs is loaded
 * again when the signal returns (recaptchaRetry.ts).
 */
export function getFirebase(): FirebaseServices {
  if (services) return services
  const env = readFirebaseEnv({
    VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID,
    VITE_RECAPTCHA_ENTERPRISE_SITE_KEY: import.meta.env.VITE_RECAPTCHA_ENTERPRISE_SITE_KEY,
  })
  if (!env.ok) {
    services = { ok: false, missing: env.missing }
    return services
  }
  // Behind import.meta.env.DEV, which is the constant false in a production
  // build, so the debug token from .env.local never reaches the hosted bundle.
  const debug = import.meta.env.DEV
    ? appCheckDebugSetting({ DEV: true, VITE_APPCHECK_DEBUG_TOKEN: import.meta.env.VITE_APPCHECK_DEBUG_TOKEN })
    : undefined
  if (debug !== undefined) globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = debug

  const app = initializeApp(env.firebaseConfig)
  const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(env.recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  })
  // Straight after initializeAppCheck, before its reCAPTCHA script can fail.
  retryRecaptchaScript(browserPage(window))
  const emulators = wantsEmulators({ DEV: import.meta.env.DEV, VITE_FIREBASE_EMULATORS: import.meta.env.VITE_FIREBASE_EMULATORS })
  // The persistent cache keeps saved alerts and the officer list on the laptop,
  // and the signed-in officer stays signed in, so approving still works with no
  // signal and uploads when it's back. With the emulators both stay in memory:
  // they share the real project's ID, and test users and data must never mix
  // with the real project's in IndexedDB.
  const db = initializeFirestore(app, {
    localCache: emulators ? memoryLocalCache() : persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  })
  const auth = emulators
    ? initializeAuth(app, { persistence: inMemoryPersistence, popupRedirectResolver: browserPopupRedirectResolver })
    : getAuth(app)
  if (emulators) {
    connectAuthEmulator(auth, EMULATORS.auth)
    connectFirestoreEmulator(db, EMULATORS.firestore.host, EMULATORS.firestore.port)
  }
  services = { ok: true, app, appCheck, auth, db, emulators }
  return services
}
