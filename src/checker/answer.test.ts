/**
 * Rule 8: an AI answer to a resident's question is checked against the
 * approved alert on the phone. Hand-written from the demo alert
 * (fixtures/halimbawa.ts): GOOD_DRAFT and its Filipino and Cebuano translations.
 */
import { describe, expect, it } from 'vitest'
import { ANSWER_CLAIM_WORDS, CHECKER_CLAIM_WORDS, TRANSLATION_CLAIMS } from '../config/defaults'
import { checkAnswer, placeNames, type AnswerAlert, type AnswerOptions } from './answer'
import { GOOD_CEBUANO, GOOD_DRAFT, GOOD_FILIPINO } from './fixtures/halimbawa'

const NAMES = ['Typhoon Sample', 'Purok Ilaya']
const ENGLISH: AnswerAlert = { english: GOOD_DRAFT, shown: GOOD_DRAFT, names: NAMES }
const FILIPINO: AnswerAlert = { english: GOOD_DRAFT, shown: GOOD_FILIPINO, names: NAMES }
const CEBUANO: AnswerAlert = { english: GOOD_DRAFT, shown: GOOD_CEBUANO, names: NAMES }

const options = (language: string): AnswerOptions => ({
  language,
  claimWords: [...CHECKER_CLAIM_WORDS],
  answerClaims: [...ANSWER_CLAIM_WORDS],
  translatedClaims: [...TRANSLATION_CLAIMS.fil, ...TRANSLATION_CLAIMS.ceb],
})

const messages = (answer: string, alert = ENGLISH, language = 'en') =>
  checkAnswer(answer, alert, options(language)).issues.map((i) => i.message)

describe('checkAnswer: answers that pass', () => {
  it('passes an answer copied from the alert', () => {
    expect(checkAnswer('Evacuate now to Halimbawa Elementary School gym.', ENGLISH, options('en'))).toEqual({ pass: true, issues: [] })
  })

  it('passes the landfall time said about landfall, with a word or two of its own', () => {
    expect(messages('Typhoon Sample makes landfall at 6 PM on Nov 14.')).toEqual([])
  })

  it('passes the hotline written another way', () => {
    expect(messages('For help, call the hotline at 09175550100.')).toEqual([])
  })

  it('passes a Filipino answer in the words of the published Filipino alert', () => {
    expect(messages('Lumikas na sa Halimbawa Elementary School gym.', FILIPINO, 'fil')).toEqual([])
  })

  it('passes a Cebuano answer in the words of the published Cebuano alert', () => {
    expect(messages('Bakwit na karon sa Halimbawa Elementary School gym.', CEBUANO, 'ceb')).toEqual([])
  })

  it('passes "the" in front of a place name', () => {
    expect(messages('Go to the Halimbawa Elementary School gym now.')).toEqual([])
  })
})

describe('checkAnswer: figures', () => {
  it('flags a time the alert does not have', () => {
    expect(messages('Typhoon Sample makes landfall at 9 PM on Nov 14.')).toEqual(['“9 PM” is not in your alert.'])
  })

  it('flags the landfall time moved to another event in an English answer', () => {
    expect(messages('Evacuate now, by 6 PM, to Halimbawa Elementary School gym.')).toEqual([
      '“6 PM” is when the storm makes landfall; the answer uses it for something else.',
    ])
  })

  it('flags a signal number the alert does not have', () => {
    expect(messages('Signal No. 4 is raised over Purok Ilaya.')).toEqual(['“Signal No. 4” is not in your alert.'])
  })

  it('flags a Filipino time that differs from the alert', () => {
    expect(messages('Tatama ang bagyo sa alas-7 ng gabi sa Nov 14.', FILIPINO, 'fil')).toEqual(['“alas-7 ng gabi” is not in your alert.'])
  })
})

describe('checkAnswer: places', () => {
  it('flags a place the alert does not name', () => {
    expect(messages('Evacuate now to the church.')).toEqual(['“church” is not a place your alert names.'])
  })

  it('flags part of a centre’s name, which could be another place', () => {
    expect(messages('Evacuate now to the gym.')).toEqual(['“gym” is not a place your alert names.'])
  })

  it('flags a known kind of place with another name in front', () => {
    expect(messages('Evacuate now to Halimbawa Municipal Gym.')).toEqual(['“Halimbawa Municipal Gym” is not a place your alert names.'])
  })

  it('flags a purok the alert does not name', () => {
    expect(messages('Signal No. 3 is raised over Purok 5.')).toEqual(['“Purok 5” is not a place your alert names.'])
  })

  it('flags a Filipino word for a place outside the alert’s names', () => {
    expect(messages('Lumikas na sa simbahan.', FILIPINO, 'fil')).toEqual(['“simbahan” is not a place your alert names.'])
  })
})

describe('checkAnswer: claims', () => {
  it('flags a severity word the alert does not say', () => {
    expect(messages('Evacuate now to Halimbawa Elementary School gym, because the storm is severe.')).toContain(
      '“severe” is not in your alert.',
    )
  })

  it('flags "safe" when the alert does not say it', () => {
    expect(messages('Halimbawa Elementary School gym is safe.')).toContain('“safe” is not in your alert.')
  })

  it('flags an answer that tells the resident to stay home', () => {
    expect(messages('You can stay home.')).toContain('“stay home” is not in your alert.')
  })

  it('flags "no need" to evacuate', () => {
    expect(messages('There is no need to evacuate now.')).toContain('“no need” is not in your alert.')
  })

  it('flags a Filipino danger word the English alert does not back', () => {
    expect(messages('Mapanganib ang bagyo, kaya lumikas na.', FILIPINO, 'fil')).toEqual(['“Mapanganib” (“danger”) is not in your alert.'])
  })

  it('flags a Cebuano "stay home" phrase', () => {
    expect(messages('Pabilin sa balay.', CEBUANO, 'ceb')).toContain('“Pabilin sa balay” is not in your alert.')
  })

  it('allows a claim word that the alert itself says', () => {
    const alert = { ...ENGLISH, english: `${GOOD_DRAFT} Strong winds are possible.`, shown: `${GOOD_DRAFT} Strong winds are possible.` }
    expect(messages('Strong winds are possible.', alert)).toEqual([])
  })
})

describe('checkAnswer: grounded in the alert', () => {
  it('flags an answer about something else, as a prompt injection would write', () => {
    expect(messages('Cats are soft and warm.')).toEqual(['Too many words that aren’t in your alert: “Cats”, “soft”, “warm”.'])
  })

  it('flags a bare "Yes."', () => {
    expect(messages('Yes.')).toEqual(['Too many words that aren’t in your alert: “Yes”.'])
  })

  it('flags "the storm is fake"', () => {
    expect(messages('The storm is fake.')).toContain('“fake” is not in your alert.')
  })

  it('flags an empty answer', () => {
    expect(messages(' ')).toEqual(['The answer is empty.'])
  })
})

describe('checkAnswer: plain and short', () => {
  it('flags another script, as Nano wrote on Nov 12', () => {
    expect(messages('कृपया evacuate now to Halimbawa Elementary School gym.')).toContain(
      '“कृपया” is in another script; alerts use Latin letters and the digits 0 to 9.',
    )
  })

  it('flags a placeholder', () => {
    expect(messages('Evacuate now to [School Name].')).toContain('Placeholder “[School Name]” must be replaced with a real fact.')
  })

  it('flags more than three sentences', () => {
    expect(messages('Evacuate now. Evacuate now. Evacuate now. Evacuate now.')).toContain('4 sentences; the limit is 3.')
  })
})

describe('placeNames', () => {
  it('reads a centre, a purok and the Barangay Hall as names', () => {
    const text = 'Signal No. 3 is raised over Purok Ilaya, so go to Halimbawa Elementary School gym or the Barangay Hall.'
    expect(placeNames(text).map((s) => s.text)).toEqual(['Purok Ilaya', 'Halimbawa Elementary School gym', 'Barangay Hall'])
  })

  it('does not read "the evacuation centre" as a place', () => {
    expect(placeNames('Go to the evacuation centre at Barangay Hall.').map((s) => s.text)).toEqual(['Barangay Hall'])
  })
})
