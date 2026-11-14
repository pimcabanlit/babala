import type { ReactNode } from 'react'
import { PATHS } from '../route'

/**
 * The navy bar at the top of every page: the logo (a link home
 * from the other pages), the page's name, and its own controls on the right.
 * It spans the window on every page, as Google's own apps do, so the logo
 * stays in one place whichever page is open.
 */
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
    <header className="bg-brand text-on-brand">
      <div className="flex h-16 items-center gap-3 px-4 lg:px-6">
        {leading}
        {home ? (
          <div className="flex shrink-0 items-center gap-3">{brand}</div>
        ) : (
          <a href={PATHS.home} className="flex shrink-0 items-center gap-3 rounded-sm focus-visible:outline-on-brand">
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
