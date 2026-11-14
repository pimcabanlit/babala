import OfficerConsole from '../console/OfficerConsole'
import { PATHS } from '../route'
import SetupStatus from '../SetupStatus'
import AppBar from '../ui/AppBar'
import { TITLE, WIDTH } from '../ui/layout'
import OfficerGate from './OfficerGate'

/**
 * The officer workspace at /officer. App.tsx loads it only when it opens, so
 * the home page and residents' phones never parse the console or start its
 * Firebase checks.
 */
export default function OfficerPage() {
  return (
    <>
      <AppBar title={TITLE.officer} width={WIDTH.officer} />
      <main className={`mx-auto w-full flex-1 px-4 py-8 ${WIDTH.officer}`}>
        <h1 className="sr-only">Officer workspace</h1>
        <p className="text-body-lg text-on-surface-variant">
          Draft, check and approve typhoon alerts from a storm bulletin.{' '}
          <a className="font-medium text-primary underline underline-offset-2" href={PATHS.resident}>
            Open the resident view
          </a>{' '}
          to see what residents’ phones show.
        </p>
        <SetupStatus />
        <OfficerGate>{(session) => <OfficerConsole session={session} />}</OfficerGate>
      </main>
    </>
  )
}
