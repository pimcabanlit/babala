import { initializeApp, type FirebaseApp } from 'firebase/app'
import { ReCaptchaEnterpriseProvider, initializeAppCheck, type AppCheck } from 'firebase/app-check'
import { appCheckDebugSetting, readFirebaseEnv } from './env'

declare global {
  // Read by the App Check SDK before it initializes. Development only.
  var FIREBASE_APPCHECK_DEBUG_TOKEN: string | boolean | undefined
}

export type FirebaseServices =
  | { ok: true; app: FirebaseApp; appCheck: AppCheck }
  | { ok: false; missing: string[] }

let services: FirebaseServices | undefined

/**
 * Starts Firebase and App Check once. App Check must start before any AI Logic
 * call, because AI Logic is enforced: requests without a valid token are refused.
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
  services = { ok: true, app, appCheck }
  return services
}
