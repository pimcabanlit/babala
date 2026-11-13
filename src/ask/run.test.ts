/**
 * Answering one question across the routes, with fake model calls: each AI
 * answer is checked against the alert, and the text search catches the rest.
 */
import { describe, expect, it, vi } from 'vitest'
import { ANSWER_CLAIM_WORDS, CHECKER_CLAIM_WORDS, TRANSLATION_CLAIMS } from '../config/defaults'
import { GOOD_DRAFT } from '../checker/fixtures/halimbawa'
import type { AiRoute } from './route'
import { answerQuestion, type AskDeps, type AskInput, type CheckWords } from './run'

const INPUT: AskInput = {
  question: 'Where do we go?',
  alert: { english: GOOD_DRAFT, shown: GOOD_DRAFT, names: ['Typhoon Sample', 'Purok Ilaya'] },
  language: 'en',
}
const WORDS: CheckWords = {
  claimWords: [...CHECKER_CLAIM_WORDS],
  answerClaims: [...ANSWER_CLAIM_WORDS],
  translatedClaims: [...TRANSLATION_CLAIMS.fil, ...TRANSLATION_CLAIMS.ceb],
}
const CENTRE = 'Landfall is expected at 6 PM on Nov 14, so evacuate now to Halimbawa Elementary School gym.'

const json = (answer: string, sentences = [2], inAlert = true) => JSON.stringify({ in_alert: inAlert, sentences, answer })

/** Fake calls: each route answers with its own text, or throws. */
function deps(replies: Partial<Record<AiRoute, string | Error | Promise<string>>>, extra: Partial<AskDeps> = {}): AskDeps {
  return {
    call: vi.fn(async (route: AiRoute) => {
      const reply = replies[route]
      if (reply === undefined) throw new Error(`no fake reply for ${route}`)
      if (reply instanceof Error) throw reply
      return { text: await reply, source: route === 'on_device' ? 'on_device' : 'in_cloud' }
    }),
    onDeviceBudgetMs: 30_000,
    ...extra,
  }
}

describe('answerQuestion', () => {
  it('returns an on-device answer that passes the check, quoting the sentence it cites', async () => {
    const d = deps({ on_device: json('Evacuate now to Halimbawa Elementary School gym.') })
    const outcome = await answerQuestion(INPUT, { tries: ['on_device', 'cloud'] }, WORDS, d)
    expect(outcome).toEqual({
      kind: 'answer',
      route: 'on_device',
      source: 'on_device',
      answer: 'Evacuate now to Halimbawa Elementary School gym.',
      quotes: [CENTRE],
      tries: [],
    })
    expect(d.call).toHaveBeenCalledTimes(1)
  })

  it('holds back an on-device answer with an added claim, and asks the cloud once', async () => {
    const d = deps({
      on_device: json('Evacuate now to Halimbawa Elementary School gym, the storm is severe.'),
      cloud: json('Evacuate now to Halimbawa Elementary School gym.'),
    })
    const outcome = await answerQuestion(INPUT, { tries: ['on_device', 'cloud'] }, WORDS, d)
    expect(outcome.kind === 'answer' && outcome.route).toBe('cloud')
    expect(outcome.tries).toEqual([
      { route: 'on_device', outcome: 'held', issues: [expect.objectContaining({ message: '“severe” is not in your alert.' })] },
    ])
  })

  it('falls back to the text search when the cloud’s answer names another place', async () => {
    const d = deps({ cloud: json('Evacuate now to the church.') })
    const outcome = await answerQuestion(INPUT, { tries: ['cloud'] }, WORDS, d)
    expect(outcome).toMatchObject({ kind: 'search', result: { found: true, sentences: [CENTRE] } })
    expect(outcome.tries[0]).toMatchObject({ route: 'cloud', outcome: 'held' })
  })

  it('stops waiting for the device after the budget and asks the cloud', async () => {
    vi.useFakeTimers()
    try {
      const never = new Promise<string>(() => undefined)
      const d = deps({ on_device: never, cloud: json('Evacuate now to Halimbawa Elementary School gym.') }, { onDeviceBudgetMs: 30_000 })
      const pending = answerQuestion(INPUT, { tries: ['on_device', 'cloud'] }, WORDS, d)
      await vi.advanceTimersByTimeAsync(30_000)
      const outcome = await pending
      expect(outcome.kind === 'answer' && outcome.route).toBe('cloud')
      expect(outcome.tries).toEqual([{ route: 'on_device', outcome: 'slow', seconds: 30 }])
    } finally {
      vi.useRealTimers()
    }
  })

  it('records a cloud error and answers with the text search', async () => {
    const d = deps({ cloud: new Error('429 quota exceeded') })
    const outcome = await answerQuestion(INPUT, { tries: ['cloud'] }, WORDS, d)
    expect(outcome).toMatchObject({ kind: 'search', tries: [{ route: 'cloud', outcome: 'error', error: '429 quota exceeded' }] })
  })

  it('treats an answer that isn’t JSON as unreadable', async () => {
    const outcome = await answerQuestion(INPUT, { tries: ['cloud'] }, WORDS, deps({ cloud: 'Go to the gym!' }))
    expect(outcome.tries).toEqual([{ route: 'cloud', outcome: 'unreadable' }])
  })

  it('says the alert doesn’t answer when the model finds nothing, without asking another route', async () => {
    const d = deps({ on_device: json('', [], false), cloud: json('Evacuate now to Halimbawa Elementary School gym.') })
    const outcome = await answerQuestion({ ...INPUT, question: 'Can I bring my dog?' }, { tries: ['on_device', 'cloud'] }, WORDS, d)
    expect(outcome).toEqual({ kind: 'not-in-alert', route: 'on_device', source: 'on_device', tries: [] })
    expect(d.call).toHaveBeenCalledTimes(1)
  })

  it('quotes the search’s sentences when a passing answer cites none', async () => {
    const outcome = await answerQuestion(INPUT, { tries: ['cloud'] }, WORDS, deps({ cloud: json('Evacuate now to Halimbawa Elementary School gym.', []) }))
    expect(outcome.kind === 'answer' && outcome.quotes).toEqual([CENTRE])
  })

  it('counts each cloud call before it is made', async () => {
    const onCloudCall = vi.fn()
    await answerQuestion(INPUT, { tries: ['cloud'] }, WORDS, deps({ cloud: new Error('offline') }, { onCloudCall }))
    expect(onCloudCall).toHaveBeenCalledTimes(1)
  })

  it('answers with the text search and the reason when no AI route can run', async () => {
    const d = deps({})
    const outcome = await answerQuestion(INPUT, { tries: [], searchOnly: 'Offline.' }, WORDS, d)
    expect(outcome).toEqual({ kind: 'search', result: { found: true, sentences: [CENTRE] }, tries: [], reason: 'Offline.' })
    expect(d.call).not.toHaveBeenCalled()
  })
})
