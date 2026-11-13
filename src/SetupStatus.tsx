import { getToken, onTokenChanged } from 'firebase/app-check'
import { useEffect, useState } from 'react'
import { getFirebase } from './firebase'
import { loadTunables, type Tunables } from './firebase/remoteConfig'
import Card from './ui/Card'
import Icon from './ui/Icon'

type Check = { state: 'pending' } | { state: 'ok'; detail: string } | { state: 'error'; detail: string }

const firebase = getFirebase()

/** Day-1 setup check: shows whether Firebase, App Check and Remote Config work. */
export default function SetupStatus() {
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

  if (!firebase.ok) {
    return (
      <Panel>
        <Row label="Firebase" check={{ state: 'error', detail: 'not configured' }} />
        <p className="mt-3 text-body-md text-on-surface-variant">
          Copy <code>.env.example</code> to <code>.env.local</code> and fill in: {firebase.missing.join(', ')}.
        </p>
      </Panel>
    )
  }

  const rc: Check =
    tunables === undefined
      ? { state: 'pending' }
      : tunables instanceof Error
        ? { state: 'error', detail: tunables.message }
        : {
            state: 'ok',
            detail: `cloud model ${tunables.cloudModelName} (${tunables.sources.cloud_model_name}), on-device budget ${tunables.ondeviceBudgetSeconds} s (${tunables.sources.ondevice_budget_seconds})`,
          }

  return (
    <Panel>
      <Row label="Firebase" check={{ state: 'ok', detail: `project ${firebase.app.options.projectId}` }} />
      <Row label="App Check" check={appCheck} />
      <Row label="Remote Config" check={rc} />
      {firebase.emulators && (
        <Row
          label="Emulators"
          check={{ state: 'ok', detail: 'on: sign-in and saved alerts use local test copies, not the real project' }}
        />
      )}
      {appCheck.state === 'error' && import.meta.env.DEV && (
        <p className="mt-3 text-body-md text-on-surface-variant">
          Running locally? Open the browser console, copy the App Check debug token it printed, and
          register it in the Firebase console under App Check &gt; Apps &gt; Babala web &gt; Manage debug
          tokens. Then put it in <code>.env.local</code> as <code>VITE_APPCHECK_DEBUG_TOKEN</code> and reload.
        </p>
      )}
    </Panel>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <Card title="Setup status" className="mt-8">
      <ul className="space-y-2">{children}</ul>
    </Card>
  )
}

function Row({ label, check }: { label: string; check: Check }) {
  return (
    <li className="flex gap-2 text-body-md">
      {check.state === 'ok' && <Icon name="check_circle" className="size-5 text-success" />}
      {check.state === 'error' && <Icon name="error" className="size-5 text-error" />}
      {check.state === 'pending' && <span className="size-5 shrink-0" />}
      <p>
        <span className="sr-only">{check.state === 'ok' ? 'Working. ' : check.state === 'error' ? 'Problem. ' : ''}</span>
        <span className="font-medium">{label}:</span>{' '}
        <span className="text-on-surface-variant">{check.state === 'pending' ? 'checking…' : check.detail}</span>
      </p>
    </li>
  )
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
