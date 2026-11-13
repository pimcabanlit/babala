import OfficerConsole from './console/OfficerConsole'
import OfficerGate from './officer/OfficerGate'
import ResidentView from './resident/ResidentView'
import { isResidentPath } from './resident/route'
import SetupStatus from './SetupStatus'

export default function App() {
  const resident = isResidentPath(window.location.pathname)
  return (
    <div className="min-h-screen">
      <div role="alert" className="bg-warning-container px-4 py-2 text-center text-label-lg text-on-warning-container">
        Demo, not official guidance. The storm and barangay are fictional.
      </div>
      <header className="bg-brand text-on-brand">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <img src="/icon.svg" alt="" className="size-9" />
          <h1 className="text-title-lg font-medium">Babala</h1>
          <p className="text-body-md text-on-brand-variant">{resident ? 'Resident alert' : 'Officer console'}</p>
        </div>
      </header>
      <main className={`mx-auto max-w-3xl px-4 ${resident ? 'py-5' : 'py-8'}`}>
        {resident ? (
          <ResidentView />
        ) : (
          <>
            <p className="text-body-lg text-on-surface-variant">
              Checked typhoon alerts that still work when the signal drops.{' '}
              <a className="font-medium text-primary underline underline-offset-2" href="/resident">
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
