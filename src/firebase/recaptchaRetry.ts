/**
 * App Check loads reCAPTCHA's script once, when the page starts, and listens
 * only for it loading. When the page opens with no signal (the saved app, from
 * the service worker), the script fails, and from then on every App Check
 * token waits forever. Firestore waits for a token before every connection, so
 * the resident view would never go live, and an officer's offline approvals
 * would never upload, until a reload. This loads the script again, with App
 * Check's own load handler, once the signal is back.
 *
 * It relies on how @firebase/app-check 0.13 (firebase 13.3.0, pinned) adds the
 * script: one script element with this address and an `onload` handler. If a
 * later version adds it differently, no script is found and this does nothing,
 * which leaves the SDK's own behaviour.
 */
export const RECAPTCHA_ENTERPRISE_SCRIPT = 'https://www.google.com/recaptcha/enterprise.js?render=explicit'

export const FIRST_RETRY_MS = 5_000
export const MAX_RETRY_MS = 30_000

/** The page parts this uses, so tests can pass a small fake. */
export type ScriptElement = {
  src: string
  onload: ((this: GlobalEventHandlers, ev: Event) => unknown) | null
  addEventListener(type: 'load' | 'error', listener: () => void, options: { once: true }): void
  remove(): void
}

export type Page = {
  findScript(src: string): ScriptElement | null
  createScript(): ScriptElement
  appendScript(script: ScriptElement): void
  isOnline(): boolean
  /** Calls back when the browser says it's online again, or the page is shown again. Returns a stop function. */
  onSignalMaybeBack(callback: () => void): () => void
  setTimeout(callback: () => void, ms: number): number
  clearTimeout(id: number): void
}

/**
 * Starts watching the reCAPTCHA script that `initializeAppCheck` just added.
 * Call it straight after `initializeAppCheck`, in the same task, so the script
 * can't have failed before the watch starts. Returns a stop function.
 */
export function retryRecaptchaScript(page: Page): () => void {
  const first = page.findScript(RECAPTCHA_ENTERPRISE_SCRIPT)
  if (!first?.onload) return () => undefined
  const onload = first.onload

  let failed = false
  let delay = FIRST_RETRY_MS
  let timer: number | undefined
  const stopTimer = () => {
    if (timer !== undefined) page.clearTimeout(timer)
    timer = undefined
  }
  const schedule = () => {
    stopTimer()
    timer = page.setTimeout(retry, delay)
    delay = Math.min(delay * 2, MAX_RETRY_MS)
  }
  const watch = (script: ScriptElement) => {
    script.addEventListener('load', () => stop(), { once: true })
    script.addEventListener(
      'error',
      () => {
        failed = true
        // A failed element is left with nothing to do; the next try adds a fresh one.
        script.remove()
        schedule()
      },
      { once: true },
    )
  }
  function retry() {
    timer = undefined
    if (!failed) return
    // Offline, a try would only fail again; wait for the next turn or the "online" event.
    if (!page.isOnline()) {
      schedule()
      return
    }
    failed = false
    const again = page.createScript()
    again.src = RECAPTCHA_ENTERPRISE_SCRIPT
    again.onload = onload
    watch(again)
    page.appendScript(again)
  }
  const stopListening = page.onSignalMaybeBack(() => {
    delay = FIRST_RETRY_MS
    stopTimer()
    retry()
  })
  function stop() {
    stopTimer()
    stopListening()
  }

  watch(first)
  return stop
}

/** The real page, for `retryRecaptchaScript`. */
export function browserPage(win: Window): Page {
  const doc = win.document
  return {
    findScript: (src) => {
      for (const s of Array.from(doc.scripts)) if (s.getAttribute('src') === src) return s
      return null
    },
    createScript: () => doc.createElement('script'),
    appendScript: (script) => doc.head.appendChild(script as HTMLScriptElement),
    isOnline: () => win.navigator.onLine,
    onSignalMaybeBack: (callback) => {
      const shown = () => {
        if (doc.visibilityState === 'visible') callback()
      }
      win.addEventListener('online', callback)
      doc.addEventListener('visibilitychange', shown)
      return () => {
        win.removeEventListener('online', callback)
        doc.removeEventListener('visibilitychange', shown)
      }
    },
    setTimeout: (callback, ms) => win.setTimeout(callback, ms),
    clearTimeout: (id) => win.clearTimeout(id),
  }
}
