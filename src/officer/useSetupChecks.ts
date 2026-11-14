import { getToken, onTokenChanged } from 'firebase/app-check'
import { useEffect, useState } from 'react'
import { getFirebase } from '../firebase'
import { loadTunables, type Tunables } from '../firebase/remoteConfig'

export type Check = { state: 'pending' } | { state: 'ok'; detail: string } | { state: 'error'; detail: string }

export type SetupChecks =
  | { configured: false; missing: string[] }
  | { configured: true; project: string; appCheck: Check; remoteConfig: Check; emulators: boolean }

const firebase = getFirebase()

/** Whether Firebase, App Check and Remote Config work, for the System status panel and the drawer's summary. */
export function useSetupChecks(): SetupChecks {
  const [appCheck, setAppCheck] = useState<Check>({ state: 'pending' })
  const [tunables, setTunables] = useState<Tunables | Error | undefined>()

  useEffect(() => {
    if (!firebase.ok) return
    const received = (token: string) =>
      setAppCheck({
        state: 'ok',
        detail: `token received, valid until ${new Date(token ? expiry(token) : Date.now()).toLocaleTimeString()}`,
      })
    // reCAPTCHA that never loads (no signal, or a blocker) leaves getToken waiting forever.
    Promise.race([getToken(firebase.appCheck), noTokenAfter(APP_CHECK_WAIT_MS)])
      .then((t) => received(t.token))
      .catch((err: unknown) => setAppCheck({ state: 'error', detail: errorText(err) }))
    loadTunables(firebase.app).then(setTunables, (err: unknown) => setTunables(new Error(errorText(err))))
    // A token that comes later, such as when the signal returns, turns the row back to ✓.
    return onTokenChanged(firebase.appCheck, (t) => received(t.token))
  }, [])

  if (!firebase.ok) return { configured: false, missing: firebase.missing }
  const remoteConfig: Check =
    tunables === undefined
      ? { state: 'pending' }
      : tunables instanceof Error
        ? { state: 'error', detail: tunables.message }
        : {
            state: 'ok',
            detail: `cloud model ${tunables.cloudModelName} (${tunables.sources.cloud_model_name}), on-device budget ${tunables.ondeviceBudgetSeconds} s (${tunables.sources.ondevice_budget_seconds})`,
          }
  return { configured: true, project: firebase.app.options.projectId ?? '', appCheck, remoteConfig, emulators: firebase.emulators }
}

/** Reads the expiry from an App Check token (a JWT) without showing the token itself. */
function expiry(jwt: string): number {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number }
    return payload.exp ? payload.exp * 1000 : Date.now()
  } catch {
    return Date.now()
  }
}

const APP_CHECK_WAIT_MS = 15_000

function noTokenAfter(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error(`no token after ${ms / 1000} s. reCAPTCHA may not have loaded: no signal, or blocked by a browser extension.`)),
      ms,
    ),
  )
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
