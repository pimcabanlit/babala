import { describe, expect, it } from 'vitest'
import type { Route } from '../ai'
import type { Issue } from '../checker'
import { nextStep } from './route'
import { runRound, type AttemptEnd, type RoundDeps } from './round'

const PASSING = 'Signal No. 3 is raised in Purok 1. Go to Halimbawa Elementary School gym. Call 0917 000 0000.'
const FAILING = 'Signal No. 3 is raised in Purok 1 tonight.'
const TONIGHT: Issue = { rule: 'added-claims', message: '“tonight” is not in the bulletin.' }

type Call = { route: Route; prompt: string; retry: boolean }

/**
 * A round with made-up attempts: each answer is a text, or a function that
 * runs while the attempt is in progress (to cancel it) and returns its end.
 */
function setup(answers: (string | ((signal: AbortSignal) => Promise<Omit<AttemptEnd, 'attemptId'>>))[], warmUp: Promise<unknown> = Promise.resolve()) {
  const controller = new AbortController()
  const calls: Call[] = []
  const checked: [number, boolean][] = []
  const manual: string[] = []
  let id = 0
  const deps: RoundDeps = {
    warmUp: () => warmUp,
    next: (outcomes) => nextStep(outcomes, { online: true, onDeviceReady: true }),
    prompt: () => 'draft prompt',
    retryPrompt: (text) => `retry prompt for: ${text}`,
    attempt: async (route, prompt, retry) => {
      calls.push({ route, prompt, retry })
      const answer = answers[calls.length - 1]
      const attemptId = ++id
      if (answer === undefined) throw new Error('No answer left for this attempt')
      return { attemptId, ...(typeof answer === 'string' ? { text: answer } : await answer(controller.signal)) }
    },
    check: (text) => (text === PASSING ? { pass: true, issues: [] } : { pass: false, issues: [TONIGHT] }),
    onChecked: (attemptId, passed) => checked.push([attemptId, passed]),
    onManual: (reason) => manual.push(reason),
    signal: controller.signal,
  }
  return { deps, controller, calls, checked, manual }
}

/** An attempt the officer cancels while it runs: it ends the way useDrafts ends one, as soon as the signal aborts. */
const cancelledWhileRunning =
  (controller: () => AbortController) =>
  (signal: AbortSignal): Promise<Omit<AttemptEnd, 'attemptId'>> => {
    const ended = new Promise<Omit<AttemptEnd, 'attemptId'>>((resolve) =>
      signal.addEventListener('abort', () => resolve({ text: '', cancelled: true }), { once: true }),
    )
    controller().abort()
    return ended
  }

describe('runRound', () => {
  it('drafts on the device, retries there with the problems, then tries the cloud', async () => {
    const { deps, calls } = setup([FAILING, FAILING, PASSING])
    expect(await runRound(deps)).toEqual({ cancelled: false, lastDrafted: PASSING })
    expect(calls).toEqual([
      { route: 'prefer_on_device', prompt: 'draft prompt', retry: false },
      { route: 'prefer_on_device', prompt: `retry prompt for: ${FAILING}`, retry: true },
      { route: 'only_in_cloud', prompt: `retry prompt for: ${FAILING}`, retry: true },
    ])
  })

  it('makes no retry or cloud call after the officer cancels the first draft', async () => {
    let t: ReturnType<typeof setup>
    t = setup([cancelledWhileRunning(() => t.controller)])
    expect(await runRound(t.deps)).toEqual({ cancelled: true, lastDrafted: '' })
    expect(t.calls).toHaveLength(1)
    expect(t.checked).toEqual([])
  })

  it('keeps the failed draft for hand editing when the officer cancels the retry', async () => {
    let t: ReturnType<typeof setup>
    t = setup([FAILING, cancelledWhileRunning(() => t.controller)])
    expect(await runRound(t.deps)).toEqual({ cancelled: true, lastDrafted: FAILING })
    expect(t.calls.map((c) => c.route)).toEqual(['prefer_on_device', 'prefer_on_device'])
    expect(t.checked).toEqual([[1, false]])
  })

  it('starts no draft when the officer cancels while the on-device model warms up', async () => {
    const t = setup([PASSING], new Promise(() => {}))
    const round = runRound(t.deps)
    t.controller.abort()
    expect(await round).toEqual({ cancelled: true, lastDrafted: '' })
    expect(t.calls).toEqual([])
  })

  it('checks a draft that finished as the officer cancelled, and starts no other', async () => {
    let t: ReturnType<typeof setup>
    t = setup([
      async () => {
        t.controller.abort()
        return { text: FAILING }
      },
    ])
    expect(await runRound(t.deps)).toEqual({ cancelled: true, lastDrafted: FAILING })
    expect(t.calls).toHaveLength(1)
    expect(t.checked).toEqual([[1, false]])
  })

  it('keeps a draft that passed as the officer cancelled', async () => {
    let t: ReturnType<typeof setup>
    t = setup([
      async () => {
        t.controller.abort()
        return { text: PASSING }
      },
    ])
    expect(await runRound(t.deps)).toEqual({ cancelled: false, lastDrafted: PASSING })
    expect(t.checked).toEqual([[1, true]])
  })

  it('hands over to the officer, not cancelled, when the models run out of tries', async () => {
    const { deps, manual } = setup([FAILING, FAILING, FAILING])
    expect(await runRound(deps)).toEqual({ cancelled: false, lastDrafted: FAILING })
    expect(manual).toEqual(['The models could not write a passing alert: fix the highlighted words by hand.'])
  })
})
