import { describe, expect, it } from 'vitest'
import {
  FIRST_RETRY_MS,
  MAX_RETRY_MS,
  RECAPTCHA_ENTERPRISE_SCRIPT,
  retryRecaptchaScript,
  type Page,
  type ScriptElement,
} from './recaptchaRetry'

class FakeScript implements ScriptElement {
  src = ''
  onload: ScriptElement['onload'] = null
  removed = false
  private listeners: Record<string, (() => void)[]> = {}
  addEventListener(type: 'load' | 'error', listener: () => void) {
    ;(this.listeners[type] ??= []).push(listener)
  }
  remove() {
    this.removed = true
  }
  fire(type: 'load' | 'error') {
    const listeners = this.listeners[type] ?? []
    this.listeners[type] = []
    for (const l of listeners) l()
  }
}

/** A page where App Check has added its script, with timers run by hand. */
function fakePage({ withScript = true } = {}) {
  const sdkOnload = () => undefined
  const first = new FakeScript()
  first.src = RECAPTCHA_ENTERPRISE_SCRIPT
  first.onload = sdkOnload
  const added: FakeScript[] = []
  const timers = new Map<number, { callback: () => void; ms: number }>()
  let nextTimer = 1
  let signalListener: (() => void) | undefined
  const state = { online: true }
  const page: Page = {
    findScript: (src) => (withScript && src === RECAPTCHA_ENTERPRISE_SCRIPT ? first : null),
    createScript: () => new FakeScript(),
    appendScript: (script) => added.push(script as FakeScript),
    isOnline: () => state.online,
    onSignalMaybeBack: (callback) => {
      signalListener = callback
      return () => {
        signalListener = undefined
      }
    },
    setTimeout: (callback, ms) => {
      timers.set(nextTimer, { callback, ms })
      return nextTimer++
    },
    clearTimeout: (id) => {
      timers.delete(id)
    },
  }
  return {
    page,
    first,
    added,
    sdkOnload,
    state,
    pendingWaits: () => [...timers.values()].map((t) => t.ms),
    runTimers: () => {
      const due = [...timers.entries()]
      timers.clear()
      for (const [, t] of due) t.callback()
    },
    signalBack: () => signalListener?.(),
    listening: () => signalListener !== undefined,
  }
}

describe('retryRecaptchaScript', () => {
  it('does nothing when App Check added no reCAPTCHA script', () => {
    const fake = fakePage({ withScript: false })
    retryRecaptchaScript(fake.page)
    expect(fake.listening()).toBe(false)
  })

  it('adds a fresh script with App Check’s own load handler when the signal comes back', () => {
    const fake = fakePage()
    retryRecaptchaScript(fake.page)
    fake.first.fire('error')
    fake.signalBack()
    expect(fake.added).toHaveLength(1)
    expect(fake.added[0].src).toBe(RECAPTCHA_ENTERPRISE_SCRIPT)
    expect(fake.added[0].onload).toBe(fake.sdkOnload)
  })

  it('removes a script that failed to load', () => {
    const fake = fakePage()
    retryRecaptchaScript(fake.page)
    fake.first.fire('error')
    expect(fake.first.removed).toBe(true)
  })

  it('tries again on its own when no "online" event comes', () => {
    const fake = fakePage()
    retryRecaptchaScript(fake.page)
    fake.first.fire('error')
    expect(fake.pendingWaits()).toEqual([FIRST_RETRY_MS])
    fake.runTimers()
    expect(fake.added).toHaveLength(1)
  })

  it('doubles the wait after each failed try, up to the longest wait', () => {
    const fake = fakePage()
    retryRecaptchaScript(fake.page)
    fake.first.fire('error')
    const waits: number[] = []
    for (let i = 0; i < 5; i++) {
      waits.push(...fake.pendingWaits())
      fake.runTimers()
      fake.added[fake.added.length - 1].fire('error')
    }
    expect(waits).toEqual([FIRST_RETRY_MS, 2 * FIRST_RETRY_MS, 4 * FIRST_RETRY_MS, MAX_RETRY_MS, MAX_RETRY_MS])
  })

  it('waits instead of adding a script while the browser says it is offline', () => {
    const fake = fakePage()
    retryRecaptchaScript(fake.page)
    fake.first.fire('error')
    fake.state.online = false
    fake.runTimers()
    expect(fake.added).toHaveLength(0)
    expect(fake.pendingWaits()).toHaveLength(1)
  })

  it('adds no second script while one is still loading', () => {
    const fake = fakePage()
    retryRecaptchaScript(fake.page)
    fake.first.fire('error')
    fake.signalBack()
    fake.signalBack()
    expect(fake.added).toHaveLength(1)
  })

  it('adds nothing while the first script is still loading', () => {
    const fake = fakePage()
    retryRecaptchaScript(fake.page)
    fake.signalBack()
    expect(fake.added).toHaveLength(0)
  })

  it('stops watching once a script loads', () => {
    const fake = fakePage()
    retryRecaptchaScript(fake.page)
    fake.first.fire('error')
    fake.signalBack()
    fake.added[0].fire('load')
    expect(fake.listening()).toBe(false)
    expect(fake.pendingWaits()).toEqual([])
  })
})
