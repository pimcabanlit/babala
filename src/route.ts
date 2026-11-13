export type Page = 'home' | 'resident' | 'officer' | 'not-found'

/** Each page and the path it lives at. firebase.json rewrites the same paths to index.html. */
export const PATHS = {
  home: '/',
  resident: '/resident',
  officer: '/officer',
} as const satisfies Record<Exclude<Page, 'not-found'>, string>

const under = (pathname: string, path: string) => pathname === path || pathname.startsWith(`${path}/`)

/**
 * Which page a path opens. Hosting sends unknown paths to its own 404 page,
 * but the service worker opens the saved page for any path with no signal,
 * and so does the dev server, so the app needs its own answer for them.
 */
export function pageFor(pathname: string): Page {
  if (pathname === PATHS.home || pathname === '/index.html') return 'home'
  if (under(pathname, PATHS.resident)) return 'resident'
  if (under(pathname, PATHS.officer)) return 'officer'
  return 'not-found'
}
