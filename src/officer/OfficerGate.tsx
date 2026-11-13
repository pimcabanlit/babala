import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { useState, type FormEvent, type ReactNode } from 'react'
import { getFirebase } from '../firebase'
import type { SignedInUser } from './status'
import { useOfficer } from './useOfficer'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { StatusChip } from '../ui/Chip'
import Notice from '../ui/Notice'

export type OfficerSession = { uid: string; db: Firestore }

const firebase = getFirebase()

/**
 * Officer sign-in. The console, drafting included, shows only for a signed-in
 * officer, which also keeps visitors off the AI quota. Firestore rules check
 * the officer list again on every save.
 */
export default function OfficerGate({ children }: { children: (session: OfficerSession) => ReactNode }) {
  if (!firebase.ok)
    return (
      <Panel>
        <p className="text-body-md text-on-surface-variant">
          Officer sign-in needs the Firebase settings: see Setup status above.
        </p>
      </Panel>
    )
  return <Gate auth={firebase.auth} db={firebase.db}>{children}</Gate>
}

function Gate({ auth, db, children }: { auth: Auth; db: Firestore; children: (session: OfficerSession) => ReactNode }) {
  const { status, signIn, signInAsTestOfficer, signOut, signInError, busy } = useOfficer(auth, db)

  if (status.kind === 'starting')
    return (
      <Panel>
        <p className="text-body-md text-on-surface-variant">Checking who is signed in…</p>
      </Panel>
    )

  if (status.kind === 'signed-out')
    return (
      <Panel>
        <p className="text-body-md text-on-surface-variant">
          Barangay officers sign in with Google to draft, check and approve alerts.
        </p>
        <Button variant="filled" onClick={() => void signIn()} disabled={busy} className="mt-4">
          {busy ? 'Signing in…' : 'Sign in with Google'}
        </Button>
        <TestOfficerSignIn busy={busy} onSignIn={signInAsTestOfficer} />
        {signInError && (
          <Notice tone="error" className="mt-4">
            {signInError}
          </Notice>
        )}
      </Panel>
    )

  const signOutButton = (
    <Button size="sm" onClick={() => void signOut()}>
      Sign out
    </Button>
  )

  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <Who user={status.user} />
          {status.kind === 'officer' && (
            <StatusChip tone="success" icon="check_circle">
              Officer
            </StatusChip>
          )}
          <span className="ml-auto">{signOutButton}</span>
        </div>
        {status.kind === 'officer' && status.user.method === 'password' && (
          <p className="mt-3 text-body-md text-on-surface-variant">
            This is the shared test officer account for judges. Other judges see what you approve or withdraw, and the
            ledger records it under this account.
          </p>
        )}
        {status.kind === 'checking' && <p className="mt-3 text-body-md text-on-surface-variant">Checking the officer list…</p>}
        {status.kind === 'offline' && (
          <Notice tone="warning" className="mt-3">
            This laptop is offline and hasn’t seen the officer list yet. Connect once to confirm you’re an officer; after
            that, the console works offline too. If the laptop is online, look at App Check in Setup status above:
            without a ✓ there, Firestore can’t be reached.
          </Notice>
        )}
        {status.kind === 'not-officer' && <NotOnList uid={status.user.uid} />}
        {status.kind === 'error' && (
          <Notice tone="error" className="mt-3">
            Couldn’t read the officer list: {status.message} If this says “permissions”, look at App Check in Setup
            status above first: without a ✓ there, Firestore refuses this browser. Otherwise the Firestore rules from
            this repo may not be published yet. Publish them, then reload this page.
          </Notice>
        )}
        {signInError && (
          <Notice tone="error" className="mt-3">
            {signInError}
          </Notice>
        )}
      </Panel>
      {status.kind === 'officer' && children({ uid: status.user.uid, db })}
    </>
  )
}

function Who({ user }: { user: SignedInUser }) {
  return (
    <p className="text-body-md">
      Signed in as <span className="font-medium">{user.name || user.email || 'an unnamed user'}</span>
      {user.name && user.email && <span className="text-on-surface-variant"> ({user.email})</span>}
    </p>
  )
}

/**
 * Email sign-in for the one test officer account that judges share. Folded
 * away, since real officers use Google. The email and password are only in
 * the private testing instructions, never in the repo or the page.
 */
function TestOfficerSignIn({
  busy,
  onSignIn,
}: {
  busy: boolean
  onSignIn: (email: string, password: string) => Promise<void>
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void onSignIn(email, password)
  }
  return (
    <details className="mt-6 text-body-md">
      <summary className="cursor-pointer font-medium text-primary">Judges: sign in with the test officer account</summary>
      <form onSubmit={submit} className="mt-3 max-w-sm space-y-3">
        <p className="text-on-surface-variant">Use the email and password from the testing instructions.</p>
        <label className="block">
          <span className="font-medium">Email</span>
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field mt-1"
          />
        </label>
        <label className="block">
          <span className="font-medium">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field mt-1"
          />
        </label>
        <Button type="submit" variant="tonal" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in as test officer'}
        </Button>
      </form>
    </details>
  )
}

/** What a signed-in non-officer needs to send the project owner. */
function NotOnList({ uid }: { uid: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Notice tone="warning" className="mt-3">
      <p>
        You’re not on the officer list, so the console stays closed. To be added, send this user ID to the project
        owner. They add it in the Firebase console under Firestore &gt; officers.
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-3">
        <code className="rounded-xs bg-surface-container-lowest px-2 py-1 font-mono text-body-sm text-on-surface">{uid}</code>
        <Button
          size="sm"
          onClick={() =>
            navigator.clipboard.writeText(uid).then(
              () => setCopied(true),
              // The ID stays on screen, so a blocked clipboard only means copying it by hand.
              () => setCopied(false),
            )
          }
        >
          {copied ? 'Copied' : 'Copy user ID'}
        </Button>
      </p>
    </Notice>
  )
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <Card title="Officer sign-in" className="mt-6">
      {children}
    </Card>
  )
}
