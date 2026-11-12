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

declare global {
  // Read by the App Check SDK before it initializes. Development only.
  var FIREBASE_APPCHECK_DEBUG_TOKEN: string | boolean | undefined
}

export type FirebaseServices =
  | { ok: true; app: FirebaseApp; appCheck: AppCheck; auth: Auth; db: Firestore; emulators: boolean }
  | { ok: false; missing: string[] }

let services: FirebaseServices | undefined

/**
 * Starts Firebase once: App Check first, because AI Logic is enforced and
 * Firestore attaches App Check tokens only if App Check started before it.
 */
export function getFirebase(): FirebaseServices {
  if (services) return services
  const env = readFirebaseEnv(import.meta.env)
  if (!env.ok) {
    services = { ok: false, missing: env.missing }
    return services
  }
  const debug = appCheckDebugSetting(import.meta.env)
  if (debug !== undefined) globalThis.FIREBASE_APPCHECK_DEBUG_TOKEN = debug

  const app = initializeApp(env.firebaseConfig)
  const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(env.recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  })
  const emulators = wantsEmulators(import.meta.env)
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
