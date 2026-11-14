import { Component, Suspense, lazy, type ReactNode } from 'react'
import Home from './home/Home'
import { PATHS, pageFor, type Page } from './route'
import AppBar from './ui/AppBar'
import Button, { ButtonLink } from './ui/Button'
import { TITLE, WIDTH } from './ui/layout'
import Notice from './ui/Notice'

// Each view is its own chunk, so the home page starts no Firebase and phones
// never parse the officer console. The service worker saves every chunk, so
// both views still open with no signal.
const ResidentView = lazy(() => import('./resident/ResidentView'))
const OfficerPage = lazy(() => import('./officer/OfficerPage'))

export default function App() {
  const page = pageFor(window.location.pathname)
  return (
    <div className="flex min-h-screen flex-col">
      <div role="alert" className="bg-warning-container px-4 py-2 text-center text-label-lg text-on-warning-container">
        Demo, not official guidance. The storm and barangay are fictional.
      </div>
      {page === 'home' ? (
        <Home />
      ) : page === 'not-found' ? (
        <NotFound />
      ) : (
        // Each view draws its own app bar, with its own controls; until it loads, the bar shows without them.
        <PageBoundary page={page}>
          <Suspense fallback={<AppBar title={TITLE[page]} width={WIDTH[page]} />}>
            {page === 'resident' ? <ResidentView /> : <OfficerPage />}
          </Suspense>
        </PageBoundary>
      )}
    </div>
  )
}

function NotFound() {
  return (
    <>
      <AppBar width={WIDTH['not-found']} />
      <main className={`mx-auto w-full flex-1 px-4 py-8 ${WIDTH['not-found']}`}>
        <h1 className="text-headline-sm">Page not found</h1>
        <p className="mt-2 text-body-lg text-on-surface-variant">There’s no page at this address.</p>
        <ButtonLink variant="filled" href={PATHS.home} className="mt-6">
          Go to the home page
        </ButtonLink>
      </main>
    </>
  )
}

/**
 * Catches a view that fails to load or to draw, such as when the signal drops
 * while its code is still downloading, and offers a reload instead of a blank page.
 */
class PageBoundary extends Component<{ page: Exclude<Page, 'home' | 'not-found'>; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    const { page } = this.props
    return (
      <>
        <AppBar title={TITLE[page]} width={WIDTH[page]} />
        <main className={`mx-auto w-full flex-1 px-4 py-8 ${WIDTH[page]}`}>
          <Notice tone="error" role="alert">
            <p>Something went wrong opening this page. Check the signal, then reload.</p>
            <Button size="sm" className="mt-3" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </Notice>
        </main>
      </>
    )
  }
}
