import OfficerConsole from '../console/OfficerConsole'
import { getFirebase } from '../firebase'
import OfficerGate from './OfficerGate'
import { SetupRows } from './SystemStatus'
import { useSetupChecks } from './useSetupChecks'
import AppBar from '../ui/AppBar'
import { TITLE } from '../ui/layout'

const firebase = getFirebase()

/**
 * The officer workspace at /officer. App.tsx loads it only when it opens, so
 * the home page and residents' phones never parse the console or start its
 * Firebase checks.
 */
export default function OfficerPage() {
  const checks = useSetupChecks()
  if (!firebase.ok)
    return (
      <>
        <AppBar title={TITLE.officer} />
        <main className="flex-1 px-4 py-10">
          <div className="mx-auto max-w-xl rounded-xl border border-outline-variant bg-surface-container-lowest p-6 sm:p-8">
            <h1 className="text-headline-sm">Set up Firebase first</h1>
            <p className="mt-2 mb-4 text-body-lg text-on-surface-variant">
              The officer workspace needs this copy of the app’s Firebase settings. The README’s “Firebase settings” section has
              the steps.
            </p>
            <SetupRows checks={checks} />
          </div>
        </main>
      </>
    )
  return (
    <OfficerGate auth={firebase.auth} db={firebase.db} checks={checks}>
      {(session) => <OfficerConsole session={session} checks={checks} />}
    </OfficerGate>
  )
}
