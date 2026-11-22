import type { MouseEvent, ReactNode } from 'react'
import { PATHS } from '../route'

/**
 * The navy bar at the top of every page: the logo (a link home
 * from the other pages), the page's name, and its own controls on the right.
 * It spans the window on every page, as Google's own apps do, so the logo
 * stays in one place whichever page is open.
 */
/**
 * Moves focus to the page's main content (`<main id="main">`), past the bar and
 * the officer's drawer. Not by following the link: the officer workspace reads
 * the address's hash as the view to show.
 */
function skipToContent(event: MouseEvent<HTMLAnchorElement>) {
  event.preventDefault()
  const main = document.querySelector('main')
  if (!main) return
  main.tabIndex = -1
  main.focus()
}

export default function AppBar({
  title,
  home = false,
  leading,
  children,
}: {
  title?: string
  /** The home page: the logo isn't a link to itself. */
  home?: boolean
  /** A control before the logo, such as the officer workspace's menu button. */
  leading?: ReactNode
  /** Controls on the right, such as a status pill or the account menu. */
  children?: ReactNode
}) {
  const brand = (
    <>
      <img src="/icon.svg" alt="" className="size-9" />
      <span className="text-title-lg font-medium">Babala</span>
    </>
  )
  return (
    <header className="relative bg-brand text-on-brand">
      <a
        href="#main"
        onClick={skipToContent}
        // Above the window until it has focus, so screen readers still find it.
        className="absolute top-2 left-4 z-50 flex h-12 -translate-y-20 items-center rounded-full bg-surface-container-lowest px-5 text-label-lg text-primary shadow-md focus:translate-y-0"
      >
        Skip to content
      </a>
      <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
        {leading}
        {home ? (
          <div className="flex shrink-0 items-center gap-3">{brand}</div>
        ) : (
          <a href={PATHS.home} title="Home page" className="flex shrink-0 items-center gap-3 rounded-sm focus-visible:outline-on-brand">
            {brand}
          </a>
        )}
        {title && (
          // On a phone the name would push the bar's controls off the edge.
          <p className={`min-w-0 truncate text-body-md text-on-brand-variant ${children ? 'hidden sm:block' : ''}`}>{title}</p>
        )}
        {children && <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div>}
      </div>
    </header>
  )
}
