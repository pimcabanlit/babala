import type { ReactNode } from 'react'
import type { Check, SetupChecks } from './useSetupChecks'
import Dialog from '../ui/Dialog'
import Icon from '../ui/Icon'

/**
 * The System status side sheet: the setup checks first, then whatever the
 * screen adds (the models, the account and the test log in the workspace).
 */
export default function SystemStatus({
  open,
  onClose,
  checks,
  children,
}: {
  open: boolean
  onClose: () => void
  checks: SetupChecks
  children?: ReactNode
}) {
  return (
    <Dialog open={open} onClose={onClose} title="System status" side="right">
      <div className="space-y-6">
        <StatusSection title="Setup">
          <SetupRows checks={checks} />
        </StatusSection>
        {children}
      </div>
    </Dialog>
  )
}

export function StatusSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-outline-variant pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-title-sm text-on-surface-variant">{title}</h3>
      <div className="mt-2 text-body-md">{children}</div>
    </section>
  )
}

/** Firebase, App Check, Remote Config and the emulators, each with ✓ or ✗ and what it found. */
export function SetupRows({ checks }: { checks: SetupChecks }) {
  if (!checks.configured) {
    return (
      <>
        <ul className="space-y-2">
          <Row label="Firebase" check={{ state: 'error', detail: 'not configured' }} />
        </ul>
        <p className="mt-3 text-on-surface-variant">
          Copy <code>.env.example</code> to <code>.env.local</code> and fill in: {checks.missing.join(', ')}.
        </p>
      </>
    )
  }
  return (
    <>
      <ul className="space-y-2">
        <Row label="Firebase" check={{ state: 'ok', detail: `project ${checks.project}` }} />
        <Row label="App Check" check={checks.appCheck} />
        <Row label="Remote Config" check={checks.remoteConfig} />
        {checks.emulators && (
          <Row label="Emulators" check={{ state: 'ok', detail: 'on: sign-in and saved alerts use local test copies, not the real project' }} />
        )}
      </ul>
      {checks.appCheck.state === 'error' && import.meta.env.DEV && (
        <p className="mt-3 text-on-surface-variant">
          Running locally? Open the browser console, copy the App Check debug token it printed, and register it in the Firebase
          console under App Check &gt; Apps &gt; Babala web &gt; Manage debug tokens. Then put it in <code>.env.local</code> as{' '}
          <code>VITE_APPCHECK_DEBUG_TOKEN</code> and reload.
        </p>
      )}
    </>
  )
}

function Row({ label, check }: { label: string; check: Check }) {
  return (
    <li className="flex gap-2">
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
