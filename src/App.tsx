import OfficerConsole from './console/OfficerConsole'
import OfficerGate from './officer/OfficerGate'
import ResidentView from './resident/ResidentView'
import { isResidentPath } from './resident/route'
import SetupStatus from './SetupStatus'

export default function App() {
  const resident = isResidentPath(window.location.pathname)
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div
        role="alert"
        className="bg-amber-300 px-4 py-2 text-center text-sm font-semibold text-amber-950"
      >
        Demo, not official guidance. The storm and barangay are fictional.
      </div>
      <main className={`mx-auto max-w-3xl px-4 ${resident ? 'py-5' : 'py-10'}`}>
        <h1 className={`font-bold ${resident ? 'text-xl' : 'text-3xl'}`}>Babala</h1>
        {resident ? (
          <ResidentView />
        ) : (
          <>
            <p className="mt-2 text-slate-700">
              Checked typhoon alerts that still work when the signal drops.{' '}
              <a className="underline" href="/resident">
                Open the resident view
              </a>{' '}
              to see what residents’ phones show.
            </p>
            <SetupStatus />
            <OfficerGate>{(session) => <OfficerConsole session={session} />}</OfficerGate>
          </>
        )}
      </main>
    </div>
  )
}
