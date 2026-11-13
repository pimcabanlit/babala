/**
 * Starts the service worker (src/offline/sw.js) in production builds, so the
 * app itself opens with no signal. The dev server has no service worker.
 */
export type OfflineApp =
  | { state: 'ready' }
  | { state: 'starting' }
  | { state: 'unavailable'; reason: string }

let status: Promise<OfflineApp> | undefined

export function startOfflineApp(): Promise<OfflineApp> {
  status ??= register()
  return status
}

async function register(): Promise<OfflineApp> {
  if (!import.meta.env.PROD) return { state: 'unavailable', reason: 'The development server doesn’t save the app for offline use.' }
  if (!('serviceWorker' in navigator)) return { state: 'unavailable', reason: 'This browser can’t save the app for offline use.' }
  try {
    await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    return { state: 'ready' }
  } catch (err) {
    return { state: 'unavailable', reason: err instanceof Error ? err.message : String(err) }
  }
}
