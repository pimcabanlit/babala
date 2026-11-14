import type { Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { PATHS } from '../route'
import type { SignedInUser } from './status'
import SystemStatus from './SystemStatus'
import type { SetupChecks } from './useSetupChecks'
import { useOfficer } from './useOfficer'
import AppBar from '../ui/AppBar'
import Button, { LinkButton } from '../ui/Button'
import { TITLE } from '../ui/layout'
import Notice from '../ui/Notice'
import Progress from '../ui/Progress'

export type OfficerSession = {
  uid: string
  db: Firestore
  user: SignedInUser
  signOut: () => Promise<void>
  /** Why signing out failed, if it did. */
  accountError: string | undefined
}

/**
 * Officer sign-in. The workspace, drafting included, shows only for a
 * signed-in officer, which also keeps visitors off the AI quota. Firestore
 * rules check the officer list again on every save.
 */
export default function OfficerGate({
  auth,
  db,
  checks,
  children,
}: {
  auth: Auth
  db: Firestore
  checks: SetupChecks
  children: (session: OfficerSession) => ReactNode
}) {
  const officer = useOfficer(auth, db)
  const { status } = officer
  if (status.kind === 'officer')
    return children({ uid: status.user.uid, db, user: status.user, signOut: officer.signOut, accountError: officer.signInError })
  return <SignInScreen officer={officer} checks={checks} />
}

/** One centred card for every state before the workspace opens, so sign-in never jumps around the page. */
function SignInScreen({ officer, checks }: { officer: ReturnType<typeof useOfficer>; checks: SetupChecks }) {
  const { status, signIn, signInAsTestOfficer, signOut, signInError, busy } = officer
  const [statusOpen, setStatusOpen] = useState(false)

  return (
    <>
      <AppBar title={TITLE.officer} />
      <main className="flex-1 px-4 py-10">
        <div className="mx-auto max-w-md rounded-xl border border-outline-variant bg-surface-container-lowest p-6 sm:p-8">
          <img src="/icon.svg" alt="" className="size-12" />
          <h1 className="mt-4 text-headline-sm">Sign in to the officer workspace</h1>

          {status.kind === 'starting' && <Waiting text="Checking who is signed in…" />}

          {status.kind === 'signed-out' && (
            <>
              <p className="mt-2 text-body-lg text-on-surface-variant">
                Barangay officers sign in with Google to draft, check and approve alerts.
              </p>
              <GoogleButton busy={busy} onClick={() => void signIn()} />
              <TestOfficerSignIn busy={busy} onSignIn={signInAsTestOfficer} />
            </>
          )}

          {status.kind !== 'starting' && status.kind !== 'signed-out' && (
            <>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Who user={status.user} />
                <Button size="sm" className="ml-auto" onClick={() => void signOut()}>
                  Sign out
                </Button>
              </div>
              {status.kind === 'checking' && <Waiting text="Checking the officer list…" />}
              {status.kind === 'offline' && (
                <Notice tone="warning" className="mt-4">
                  This laptop is offline and hasn’t seen the officer list yet. Connect once to confirm you’re an officer; after
                  that, the workspace works offline too. If the laptop is online, open System status below and look at App
                  Check: without a ✓ there, Firestore can’t be reached.
                </Notice>
              )}
              {status.kind === 'not-officer' && <NotOnList uid={status.user.uid} />}
              {status.kind === 'error' && (
                <Notice tone="error" className="mt-4">
                  Couldn’t read the officer list: {status.message} If this says “permissions”, open System status below and look
                  at App Check first: without a ✓ there, Firestore refuses this browser. Otherwise the Firestore rules from this
                  repo may not be published yet. Publish them, then reload this page.
                </Notice>
              )}
            </>
          )}

          {signInError && (
            <Notice tone="error" className="mt-4">
              {signInError}
            </Notice>
          )}
        </div>

        <nav aria-label="Other pages" className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-x-6 gap-y-3 text-body-md">
          <a className="font-medium text-primary underline underline-offset-2" href={PATHS.home}>
            Home
          </a>
          <a className="font-medium text-primary underline underline-offset-2" href={PATHS.resident}>
            Resident view
          </a>
          <LinkButton onClick={() => setStatusOpen(true)}>System status</LinkButton>
        </nav>
      </main>
      <SystemStatus open={statusOpen} onClose={() => setStatusOpen(false)} checks={checks} />
    </>
  )
}

function Waiting({ text }: { text: string }) {
  return (
    <div className="mt-4">
      <Progress label={text} />
      <p className="mt-3 text-body-md text-on-surface-variant" role="status">
        {text}
      </p>
    </div>
  )
}

function Who({ user }: { user: SignedInUser }) {
  return (
    <p className="min-w-0 text-body-md">
      Signed in as <span className="font-medium">{user.name || user.email || 'an unnamed user'}</span>
      {user.name && user.email && <span className="text-on-surface-variant"> ({user.email})</span>}
    </p>
  )
}

/**
 * Drawn to Google's sign-in branding guidelines: white fill, a #747775
 * border, the full-colour "G" and medium 14/20 text. The only Google mark in the app.
 */
function GoogleButton({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="relative mt-6 inline-flex h-10 items-center gap-2.5 rounded-full border border-[#747775] bg-[#ffffff] pr-4 pl-3 text-[0.875rem] leading-5 font-medium text-[#1f1f1f] before:absolute before:inset-x-0 before:top-1/2 before:h-12 before:-translate-y-1/2 hover:bg-[#f7f8f8] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <svg viewBox="0 0 48 48" aria-hidden="true" className="size-5">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
      </svg>
      {busy ? 'Signing in…' : 'Sign in with Google'}
    </button>
  )
}

/**
 * Email sign-in for the one test officer account that judges share. Folded
 * away, since real officers use Google. The email and password are only in
 * the private testing instructions, never in the repo or the page.
 */
function TestOfficerSignIn({ busy, onSignIn }: { busy: boolean; onSignIn: (email: string, password: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const formId = useId()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    void onSignIn(email, password)
  }
  return (
    <div className="mt-6 border-t border-outline-variant pt-4">
      <Button variant="text" className="-ml-3" aria-expanded={open} aria-controls={formId} onClick={() => setOpen(!open)}>
        Judges: use the test officer account
      </Button>
      {open && (
        <form id={formId} onSubmit={submit} className="mt-3 space-y-3 text-body-md">
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
      )}
    </div>
  )
}

/** What a signed-in non-officer needs to send the project owner. */
function NotOnList({ uid }: { uid: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Notice tone="warning" className="mt-4">
      <p>
        You’re not on the officer list, so the workspace stays closed. To be added, send this user ID to the project owner.
        They add it in the Firebase console under Firestore &gt; officers.
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-3">
        <code className="rounded-xs bg-surface-container-lowest px-2 py-1 font-mono text-body-sm break-all text-on-surface">{uid}</code>
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
