import { getToken } from 'firebase/app-check'
import { useEffect, useState } from 'react'
import { getFirebase } from './firebase'
import { loadTunables, type Tunables } from './firebase/remoteConfig'

type Check = { state: 'pending' } | { state: 'ok'; detail: string } | { state: 'error'; detail: string }

const firebase = getFirebase()

/** Day-1 setup check: shows whether Firebase, App Check and Remote Config work. */
export default function SetupStatus() {
  const [appCheck, setAppCheck] = useState<Check>({ state: 'pending' })
  const [tunables, setTunables] = useState<Tunables | Error | undefined>()

  useEffect(() => {
    if (!firebase.ok) return
    getToken(firebase.appCheck)
      .then((t) =>
        setAppCheck({
          state: 'ok',
          detail: `token received, valid until ${new Date(t.token ? expiry(t.token) : Date.now()).toLocaleTimeString()}`,
        }),
      )
      .catch((err: unknown) => setAppCheck({ state: 'error', detail: errorText(err) }))
    loadTunables(firebase.app).then(setTunables, (err: unknown) => setTunables(new Error(errorText(err))))
  }, [])

  if (!firebase.ok) {
    return (
      <Panel>
        <Row label="Firebase" check={{ state: 'error', detail: 'not configured' }} />
        <p className="mt-3 text-sm text-slate-700">
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
        <p className="mt-3 text-sm text-slate-700">
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
    <section aria-label="Setup status" className="mt-8 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Setup status</h2>
      <ul className="mt-2 space-y-1">{children}</ul>
    </section>
  )
}

function Row({ label, check }: { label: string; check: Check }) {
  const icon = check.state === 'ok' ? '✓' : check.state === 'error' ? '✗' : '…'
  const color =
    check.state === 'ok' ? 'text-emerald-700' : check.state === 'error' ? 'text-red-700' : 'text-slate-500'
  return (
    <li className="text-sm">
      <span className={`inline-block w-5 font-bold ${color}`}>{icon}</span>
      <span className="font-medium">{label}:</span>{' '}
      <span className="text-slate-700">{check.state === 'pending' ? 'checking…' : check.detail}</span>
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

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
