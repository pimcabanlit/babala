import { Component, Suspense, lazy, type ReactNode } from 'react'
import Home from './home/Home'
import { useOfflineApp } from './offline/useOfflineApp'
import { PATHS, pageFor, type Page } from './route'
import Button, { ButtonLink } from './ui/Button'
import Icon from './ui/Icon'
import Notice from './ui/Notice'

// Each view is its own chunk, so the home page starts no Firebase and phones
// never parse the officer console. The service worker saves every chunk, so
// both views still open with no signal.
const ResidentView = lazy(() => import('./resident/ResidentView'))
const OfficerPage = lazy(() => import('./officer/OfficerPage'))

const SUBTITLE: Record<Page, string | undefined> = {
  home: 'Community warning system',
  resident: 'Resident alert',
  officer: 'Officer workspace',
  'not-found': undefined,
}

export default function App() {
  const page = pageFor(window.location.pathname)
  return (
    <div className="flex min-h-screen flex-col">
      <div role="alert" className="bg-warning-container px-4 py-2 text-center text-label-lg text-on-warning-container">
        Demo, not official guidance. The storm and barangay are fictional.
      </div>
      <AppBar page={page} />
      {page === 'home' ? (
        <Home />
      ) : (
        <main className={`mx-auto w-full max-w-3xl flex-1 px-4 ${page === 'resident' ? 'py-5' : 'py-8'}`}>
          {page === 'not-found' ? (
            <NotFound />
          ) : (
            <PageBoundary>
              <Suspense fallback={null}>{page === 'resident' ? <ResidentView /> : <OfficerPage />}</Suspense>
            </PageBoundary>
          )}
        </main>
      )}
    </div>
  )
}

function AppBar({ page }: { page: Page }) {
  const home = page === 'home'
  const brand = (
    <>
      <img src="/icon.svg" alt="" className="size-9" />
      <span className="text-title-lg font-medium">Babala</span>
    </>
  )
  return (
    <header className="bg-brand text-on-brand">
      <div className={`mx-auto flex h-16 items-center gap-3 px-4 ${home ? 'max-w-5xl' : 'max-w-3xl'}`}>
        {home ? (
          <div className="flex items-center gap-3">{brand}</div>
        ) : (
          <a href={PATHS.home} className="flex items-center gap-3 rounded-sm focus-visible:outline-on-brand">
            {brand}
          </a>
        )}
        {SUBTITLE[page] && (
          // On a phone the home page's subtitle would push the offline pill off the bar.
          <p className={`text-body-md text-on-brand-variant ${home ? 'hidden sm:block' : ''}`}>{SUBTITLE[page]}</p>
        )}
        {home && <OfflinePill />}
      </div>
    </header>
  )
}

/** Tells a first-time visitor the app now opens with no signal, once the service worker has saved it. */
function OfflinePill() {
  const app = useOfflineApp()
  // The dev server and browsers without service workers can't save the app; the resident page explains why.
  if (app.state === 'unavailable') return null
  const ready = app.state === 'ready'
  return (
    <p
      role="status"
      className="ml-auto inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-on-brand-variant/50 px-3 text-label-lg"
    >
      <Icon name={ready ? 'check_circle' : 'cloud'} className="size-[18px]" />
      {ready ? 'Offline ready' : 'Saving for offline…'}
    </p>
  )
}

function NotFound() {
  return (
    <>
      <h1 className="text-headline-sm">Page not found</h1>
      <p className="mt-2 text-body-lg text-on-surface-variant">There’s no page at this address.</p>
      <ButtonLink variant="filled" href={PATHS.home} className="mt-6">
        Go to the home page
      </ButtonLink>
    </>
  )
}

/**
 * Catches a view that fails to load or to draw, such as when the signal drops
 * while its code is still downloading, and offers a reload instead of a blank page.
 */
class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <Notice tone="error" role="alert">
        <p>Something went wrong opening this page. Check the signal, then reload.</p>
        <Button size="sm" className="mt-3" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </Notice>
    )
  }
}
