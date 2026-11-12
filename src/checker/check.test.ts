import { describe, expect, it } from 'vitest'
import { CHECKER_CLAIM_WORDS } from '../config/defaults'
import { checkDraft, checkTranslation } from './check'
import { DAY1_CASES, DAY1_SHEET } from './fixtures/day1'
import { GOOD_DRAFT, GOOD_FILIPINO, SAMPLE_SHEET } from './fixtures/halimbawa'
import type { CheckOptions, Issue, Rule } from './types'

const OPTIONS: CheckOptions = { claimWords: [...CHECKER_CLAIM_WORDS], area: 'Purok Ilaya' }

/** The flagged text per rule, for compact expectations. */
function flagged(issues: Issue[]): Partial<Record<Rule, string[]>> {
  const out: Partial<Record<Rule, string[]>> = {}
  for (const i of issues) (out[i.rule] ??= []).push(i.span?.text ?? i.message)
  return out
}

describe('day 1 real drafts: none may pass', () => {
  // The prompt had no hotline, so these drafts can't be asked for one.
  const options: CheckOptions = { claimWords: [...CHECKER_CLAIM_WORDS], required: ['signal', 'time', 'place'] }

  const expected: Record<string, Partial<Record<Rule, string[]>>> = {
    'case 2: Nano, cold first draft': {
      placeholders: ['[Village Name]'],
      'added-claims': ['imminent', 'today', 'heavy rainfall', 'strong winds', 'storm surge', 'authorities'],
    },
    'case 3: cloud, flash-lite': {
      'added-claims': ['destructive', 'today', 'worsen'],
    },
    'case 4: Nano, warm': {
      placeholders: ['[Village Name]', '[Philippine Time]'],
      'added-claims': ['imminent', 'evacuation routes'],
    },
    'case 5: Nano, Wi-Fi off': {
      'added-claims': ['this evening', 'until further notice'],
      plain: ['⚠️', '⚠️', '**TYPHOON ALERT ISSUED**'],
    },
    'case 6: Nano, Wi-Fi off': {
      placeholders: ['[Village Name]', '[School Name]'],
      places: ['gymnasium'],
      missing: ['Missing where to go: name an evacuation centre from the fact sheet.'],
      'added-claims': ['severe', 'strong winds', 'heavy rain', 'emergency personnel'],
    },
    'case 7: cloud, flash-lite, on the laptop': {
      places: ['municipal school gym'],
      'added-claims': ['this evening', 'Life-threatening', 'storm surges', 'destructive winds', 'imminent'],
    },
  }

  it.each(DAY1_CASES)('$name fails for the right reasons', ({ name, text }) => {
    const result = checkDraft(text, DAY1_SHEET, options)
    expect(result.pass).toBe(false)
    expect(flagged(result.issues)).toEqual(expected[name])
  })

  it('accepts every figure the drafts got right: Signal No. 3 and 6 PM', () => {
    for (const { text } of DAY1_CASES) {
      expect(checkDraft(text, DAY1_SHEET, options).issues.filter((i) => i.rule === 'figures')).toEqual([])
    }
  })
})

describe('checkDraft on the fictional bulletin', () => {
  it('passes a correct draft', () => {
    expect(checkDraft(GOOD_DRAFT, SAMPLE_SHEET, OPTIONS)).toEqual({ pass: true, issues: [] })
  })

  it('accepts the same facts in other spellings', () => {
    const draft =
      'Signal #3 is up over Purok Ilaya. Landfall is expected at 18:00 on November 14; go to the Barangay Hall. Call +63 917-555-0100.'
    expect(checkDraft(draft, SAMPLE_SHEET, OPTIONS).issues).toEqual([])
  })

  it('rejects a wrong time and reports the real one as missing', () => {
    const result = checkDraft(GOOD_DRAFT.replace('6 PM', '7 PM'), SAMPLE_SHEET, OPTIONS)
    expect(flagged(result.issues)).toEqual({
      figures: ['7 PM'],
      missing: ['Missing the landfall time (18:00).'],
    })
  })

  it('rejects a wrong date, hotline and an invented number', () => {
    const draft = GOOD_DRAFT.replace('Nov 14', 'Nov 15').replace('0917 555 0100', '0917 555 0199') + ' Winds reach 200 km/h.'
    expect(flagged(checkDraft(draft, SAMPLE_SHEET, { ...OPTIONS, maxSentences: 4 }).issues)).toEqual({
      figures: ['Nov 15', '0917 555 0199', '200'],
      missing: ['Missing the hotline (0917 555 0100).'],
    })
  })

  it('allows numbers the bulletin states', () => {
    const draft = 'Signal No. 3 for Purok Ilaya: landfall at 6 PM, winds of 185 km/h. Go to the Barangay Hall. Call 0917 555 0100.'
    expect(checkDraft(draft, SAMPLE_SHEET, OPTIONS).issues).toEqual([])
  })

  it('requires the signal number of the alert’s own area', () => {
    // Purok 2 is under Signal No. 2; Signal No. 3 is a real figure, but the wrong one for this area.
    const result = checkDraft(GOOD_DRAFT.replace('Purok Ilaya', 'Purok 2'), SAMPLE_SHEET, { ...OPTIONS, area: 'Purok 2' })
    expect(flagged(result.issues)).toEqual({ missing: ['Missing the signal number for Purok 2 (Signal No. 2).'] })
  })

  it('reports an unknown purok once, as a place, not also as a number', () => {
    const result = checkDraft(GOOD_DRAFT.replace('Purok Ilaya', 'Purok 5'), SAMPLE_SHEET, { ...OPTIONS, area: undefined })
    expect(flagged(result.issues)).toEqual({ places: ['Purok 5'] })
  })

  it('rejects an unknown barangay and an evacuation centre not in the fact sheet', () => {
    const draft = 'Signal No. 3 over Barangay Bago. Landfall at 6 PM; go to the parish church. Call 0917 555 0100.'
    expect(flagged(checkDraft(draft, SAMPLE_SHEET, { ...OPTIONS, area: undefined }).issues)).toEqual({
      places: ['church', 'Barangay Bago'],
      missing: ['Missing where to go: name an evacuation centre from the fact sheet.'],
    })
  })

  it('accepts a known name in any letter case', () => {
    const draft = GOOD_DRAFT.replace('Halimbawa Elementary School gym', 'the barangay hall')
    expect(checkDraft(draft, SAMPLE_SHEET, OPTIONS).issues).toEqual([])
  })

  it('allows hazard words the bulletin itself uses', () => {
    const draft = 'Signal No. 3 over Purok Ilaya: strong winds and storm surge are possible. Landfall at 6 PM; go to the Barangay Hall. Call 0917 555 0100.'
    expect(checkDraft(draft, SAMPLE_SHEET, OPTIONS).issues).toEqual([])
  })

  it('reports each missing fact', () => {
    const result = checkDraft('Please evacuate now.', SAMPLE_SHEET, OPTIONS)
    expect(result.issues.map((i) => i.rule)).toEqual(['missing', 'missing', 'missing', 'missing'])
  })

  it('lets a household type skip facts it does not need', () => {
    const fishers = 'Signal No. 3 is raised over Purok Ilaya. Do not go to sea; landfall is at 6 PM. Call 0917 555 0100.'
    expect(checkDraft(fishers, SAMPLE_SHEET, { ...OPTIONS, required: ['signal', 'time', 'hotline'] }).issues).toEqual([])
  })

  it('counts sentences without splitting on "No." or "p.m."', () => {
    const draft = 'Signal No. 3 over Purok Ilaya. Landfall at 6 p.m. on Nov 14; go to the Barangay Hall. Call 0917 555 0100.'
    expect(checkDraft(draft, SAMPLE_SHEET, OPTIONS).issues).toEqual([])
    const four = draft + ' Stay calm.'
    expect(flagged(checkDraft(four, SAMPLE_SHEET, OPTIONS).issues)).toEqual({ plain: ['4 sentences; the limit is 3.'] })
  })

  it('accepts "evacuation centre" as a common noun next to a known name', () => {
    const draft = GOOD_DRAFT.replace('evacuate now to Halimbawa', 'go now to the evacuation centre at Halimbawa')
    expect(checkDraft(draft, SAMPLE_SHEET, OPTIONS).issues).toEqual([])
    // It still names no centre on its own.
    const vague = GOOD_DRAFT.replace('evacuate now to Halimbawa Elementary School gym', 'go to the nearest evacuation center')
    expect(flagged(checkDraft(vague, SAMPLE_SHEET, OPTIONS).issues)).toEqual({
      missing: ['Missing where to go: name an evacuation centre from the fact sheet.'],
    })
  })

  it('reports "municipal school gym" once, as one place', () => {
    const draft = GOOD_DRAFT.replace('Halimbawa Elementary School gym', 'the municipal school gym')
    const places = checkDraft(draft, SAMPLE_SHEET, OPTIONS).issues.filter((i) => i.rule === 'places')
    expect(places.map((i) => [i.span?.text, i.message])).toEqual([
      ['school gym', '“the municipal school gym” is not an evacuation centre in the fact sheet.'],
    ])
  })

  it('ends a sentence at "p.m." when a new sentence follows', () => {
    const draft = 'Signal No. 3 over Purok Ilaya. Landfall at 6 p.m. Go to the Barangay Hall. Call 0917 555 0100.'
    expect(flagged(checkDraft(draft, SAMPLE_SHEET, OPTIONS).issues)).toEqual({ plain: ['4 sentences; the limit is 3.'] })
  })

  it('flags an invented wind speed written without a space', () => {
    const draft = GOOD_DRAFT + ' Winds reach 200km/h.'
    expect(flagged(checkDraft(draft, SAMPLE_SHEET, OPTIONS).issues).figures).toEqual(['200'])
  })

  it('treats "Barangay Captain" as a claim, not an unknown barangay', () => {
    const draft = GOOD_DRAFT.replace('For help,', 'For help, ask the Barangay Captain or')
    expect(flagged(checkDraft(draft, SAMPLE_SHEET, OPTIONS).issues)).toEqual({ 'added-claims': ['Barangay Captain'] })
  })

  it('does not require a hotline when the bulletin has none', () => {
    const sheet = { ...SAMPLE_SHEET, hotline: '' }
    const draft = GOOD_DRAFT.replace(' For help, call 0917 555 0100.', '')
    expect(checkDraft(draft, sheet, OPTIONS).issues).toEqual([])
  })

  it('limits the word count', () => {
    const long = GOOD_DRAFT.replace('For help,', `For help, ${'please '.repeat(30)}`)
    expect(flagged(checkDraft(long, SAMPLE_SHEET, OPTIONS).issues).plain?.[0]).toMatch(/words; the limit is 60/)
  })

  it.each(['TBD', 'XXX', '(address)', '{name}', '____', 'insert name here'])('rejects the placeholder %s', (p) => {
    const result = checkDraft(`${GOOD_DRAFT} Contact: ${p}`, SAMPLE_SHEET, { ...OPTIONS, maxSentences: 4 })
    expect(result.issues.filter((i) => i.rule === 'placeholders').map((i) => i.span?.text)).toEqual([p])
  })

  it('uses the word list it is given, so Remote Config can tune it', () => {
    const draft = GOOD_DRAFT.replace('evacuate now', 'evacuate quickly')
    expect(checkDraft(draft, SAMPLE_SHEET, OPTIONS).pass).toBe(true)
    expect(flagged(checkDraft(draft, SAMPLE_SHEET, { ...OPTIONS, claimWords: ['quickly'] }).issues)).toEqual({
      'added-claims': ['quickly'],
    })
  })

  it('gives every issue span the exact text it points at', () => {
    const text = DAY1_CASES[4].text
    const result = checkDraft(text, DAY1_SHEET_WITH_ALL(), { claimWords: [...CHECKER_CLAIM_WORDS] })
    for (const issue of result.issues) {
      if (issue.span) expect(text.slice(issue.span.start, issue.span.end)).toBe(issue.span.text)
    }
  })
})

function DAY1_SHEET_WITH_ALL() {
  return { ...DAY1_SHEET, hotline: '911' }
}

describe('checkTranslation', () => {
  it('passes a Filipino translation that keeps every figure and name', () => {
    expect(checkTranslation(GOOD_DRAFT, GOOD_FILIPINO, SAMPLE_SHEET)).toEqual({ pass: true, issues: [] })
  })

  it('rejects a changed time', () => {
    const result = checkTranslation(GOOD_DRAFT, GOOD_FILIPINO.replace('alas-6', 'alas-7'), SAMPLE_SHEET)
    expect(result.issues.map((i) => i.message)).toEqual([
      'The translation lost “6 PM” from the English alert.',
      '“alas-7 ng gabi” is in the translation but not in the English alert.',
    ])
  })

  it('rejects a translated place name', () => {
    const result = checkTranslation(
      GOOD_DRAFT,
      GOOD_FILIPINO.replace('Halimbawa Elementary School gym', 'gym ng paaralan'),
      SAMPLE_SHEET,
    )
    expect(result.issues.map((i) => i.message)).toEqual([
      'The translation must keep the place name “Halimbawa Elementary School gym” exactly.',
    ])
  })

  it('rejects an added number, a lost hotline, placeholders and emojis', () => {
    const bad = GOOD_FILIPINO.replace('0917 555 0100', '[hotline]') + ' ⚠️ 2 oras na lang.'
    expect(checkTranslation(GOOD_DRAFT, bad, SAMPLE_SHEET).issues.map((i) => i.rule)).toEqual([
      'placeholders',
      'translation',
      'translation',
      'plain',
    ])
  })

  it('accepts a Cebuano time form', () => {
    const cebuano = GOOD_FILIPINO.replace('alas-6 ng gabi', 'alas 6 sa gabii')
    expect(checkTranslation(GOOD_DRAFT, cebuano, SAMPLE_SHEET).pass).toBe(true)
  })
})
