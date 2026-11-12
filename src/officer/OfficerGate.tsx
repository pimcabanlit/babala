import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { useState, type ReactNode } from 'react'
import { getFirebase } from '../firebase'
import type { SignedInUser } from './status'
import { useOfficer } from './useOfficer'

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
        <p className="text-sm text-slate-700">
          Officer sign-in needs the Firebase settings: see Setup status above.
        </p>
      </Panel>
    )
  return <Gate auth={firebase.auth} db={firebase.db}>{children}</Gate>
}

function Gate({ auth, db, children }: { auth: Auth; db: Firestore; children: (session: OfficerSession) => ReactNode }) {
  const { status, signIn, signOut, signInError, busy } = useOfficer(auth, db)

  if (status.kind === 'starting')
    return (
      <Panel>
        <p className="text-sm text-slate-600">Checking who is signed in…</p>
      </Panel>
    )

  if (status.kind === 'signed-out')
    return (
      <Panel>
        <p className="text-sm text-slate-700">
          Barangay officers sign in with Google to draft, check and approve alerts.
        </p>
        <button
          type="button"
          onClick={() => void signIn()}
          disabled={busy}
          className="mt-3 rounded bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in with Google'}
        </button>
        {signInError && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-800">{signInError}</p>}
      </Panel>
    )

  const signOutButton = (
    <button
      type="button"
      onClick={() => void signOut()}
      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-100"
    >
      Sign out
    </button>
  )

  return (
    <>
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <Who user={status.user} />
          {status.kind === 'officer' && (
            <span className="rounded bg-emerald-700 px-2 py-0.5 text-xs font-semibold text-white">Officer</span>
          )}
          <span className="ml-auto">{signOutButton}</span>
        </div>
        {status.kind === 'checking' && <p className="mt-3 text-sm text-slate-600">Checking the officer list…</p>}
        {status.kind === 'offline' && (
          <p className="mt-3 rounded bg-amber-100 p-2 text-sm text-amber-950">
            This laptop is offline and hasn’t seen the officer list yet. Connect once to confirm you’re an officer; after
            that, the console works offline too.
          </p>
        )}
        {status.kind === 'not-officer' && <NotOnList uid={status.user.uid} />}
        {status.kind === 'error' && (
          <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-800">
            Couldn’t read the officer list: {status.message} If this says “permissions”, the Firestore rules from this
            repo may not be published yet. Publish them, then reload this page.
          </p>
        )}
        {signInError && <p className="mt-3 rounded bg-red-50 p-2 text-sm text-red-800">{signInError}</p>}
      </Panel>
      {status.kind === 'officer' && children({ uid: status.user.uid, db })}
    </>
  )
}

function Who({ user }: { user: SignedInUser }) {
  return (
    <p className="text-sm">
      Signed in as <span className="font-medium">{user.name || user.email || 'a Google user'}</span>
      {user.name && user.email && <span className="text-slate-600"> ({user.email})</span>}
    </p>
  )
}

/** What a signed-in non-officer needs to send the project owner. */
function NotOnList({ uid }: { uid: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-3 rounded bg-amber-100 p-3 text-sm text-amber-950">
      <p>
        You’re not on the officer list, so the console stays closed. To be added, send this user ID to the project
        owner. They add it in the Firebase console under Firestore &gt; officers.
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-2">
        <code className="rounded bg-white px-2 py-0.5 font-mono text-xs">{uid}</code>
        <button
          type="button"
          onClick={() =>
            navigator.clipboard.writeText(uid).then(
              () => setCopied(true),
              // The ID stays on screen, so a blocked clipboard only means copying it by hand.
              () => setCopied(false),
            )
          }
          className="rounded border border-amber-400 bg-white px-2 py-0.5 text-xs font-medium hover:bg-amber-50"
        >
          {copied ? 'Copied' : 'Copy user ID'}
        </button>
      </p>
    </div>
  )
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <section aria-label="Officer sign-in" className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Officer sign-in</h2>
      {children}
    </section>
  )
}
