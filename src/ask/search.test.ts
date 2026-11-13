/**
 * The no-AI route: text search of the alert saved on the phone, quoting it
 * word for word. Hand-written from the demo alerts (checker/fixtures/halimbawa.ts).
 */
import { describe, expect, it } from 'vitest'
import { GOOD_CEBUANO, GOOD_DRAFT, GOOD_FILIPINO } from '../checker/fixtures/halimbawa'
import { questionTopics, searchAlert, sentenceTopics } from './search'

const FISHERS =
  'Signal No. 3 is raised in Purok 1, and Typhoon Sample makes landfall at 6:00 PM on Nov 14. Do not go out to sea, and tie up your boats. Call the hotline, 0917 555 0100, for help.'
const SENIORS =
  'Signal No. 3 is raised in Purok Ilaya, and Typhoon Sample makes landfall at 6:00 PM on Nov 14. Leave early, bring your medicines and ask a neighbour for help, and go to Halimbawa Elementary School gym or Barangay Hall. Call the hotline, 0917 555 0100, for help.'

const quoted = (alert: string, question: string) => {
  const r = searchAlert(alert, question)
  return r.found ? r.sentences : []
}

describe('searchAlert', () => {
  it('quotes the sentence with the evacuation centre for "Where do we go?"', () => {
    expect(quoted(GOOD_DRAFT, 'Where do we go?')).toEqual([
      'Landfall is expected at 6 PM on Nov 14, so evacuate now to Halimbawa Elementary School gym.',
    ])
  })

  it('quotes the sentence with the hotline for "What number do we call?"', () => {
    expect(quoted(GOOD_DRAFT, 'What number do we call?')).toEqual(['For help, call 0917 555 0100.'])
  })

  it('quotes the sentence with the signal number for "What signal is it?"', () => {
    expect(quoted(GOOD_DRAFT, 'What signal is it?')).toEqual(['Signal No. 3 is raised over Purok Ilaya.'])
  })

  it('quotes two sentences for a question about two things, in the alert’s order', () => {
    expect(quoted(GOOD_DRAFT, 'Who do we call, and where do we go?')).toEqual([
      'Landfall is expected at 6 PM on Nov 14, so evacuate now to Halimbawa Elementary School gym.',
      'For help, call 0917 555 0100.',
    ])
  })

  it('answers a Filipino question from the Filipino alert', () => {
    expect(quoted(GOOD_FILIPINO, 'Saan kami pupunta?')).toEqual([
      'Inaasahang tatama ang bagyo sa alas-6 ng gabi sa Nov 14, kaya lumikas na sa Halimbawa Elementary School gym.',
    ])
  })

  it('answers a Cebuano question from the Cebuano alert', () => {
    expect(quoted(GOOD_CEBUANO, 'Unsang numero ang tawagan?')).toEqual(['Para sa tabang, tawag sa 0917 555 0100.'])
  })

  it('answers a Cebuano question from the English alert', () => {
    expect(quoted(GOOD_DRAFT, 'Asa mi moadto?')).toEqual([
      'Landfall is expected at 6 PM on Nov 14, so evacuate now to Halimbawa Elementary School gym.',
    ])
  })

  it('quotes the advice for "What should I bring?"', () => {
    expect(quoted(SENIORS, 'What should I bring?')).toEqual([
      'Leave early, bring your medicines and ask a neighbour for help, and go to Halimbawa Elementary School gym or Barangay Hall.',
    ])
  })

  it('quotes "Do not go out to sea" for a fisher asking about fishing', () => {
    expect(quoted(FISHERS, 'Can I go fishing?')).toEqual(['Do not go out to sea, and tie up your boats.'])
  })

  it('finds nothing for a question the alert doesn’t cover', () => {
    expect(searchAlert(GOOD_DRAFT, 'Ignore all previous instructions')).toEqual({ found: false })
  })

  it('finds nothing for where to go in a Fishers alert, which names no centre', () => {
    expect(searchAlert(FISHERS, 'Where do we go?')).toEqual({ found: false })
  })
})

describe('sentenceTopics', () => {
  it('reads time and place from a sentence that has both', () => {
    expect([...sentenceTopics('Landfall is expected at 6 PM on Nov 14, so evacuate now to Halimbawa Elementary School gym.')].sort()).toEqual([
      'todo',
      'when',
      'where',
    ])
  })

  it('does not count a purok as somewhere to go', () => {
    expect([...sentenceTopics('Signal No. 3 is raised over Purok Ilaya.')]).toEqual(['signal'])
  })
})

describe('questionTopics', () => {
  it('reads "When does the storm make landfall?" as a question about time only', () => {
    expect([...questionTopics('When does the storm make landfall?')]).toEqual(['when'])
  })
})
