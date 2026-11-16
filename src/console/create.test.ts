import { describe, expect, it } from 'vitest'
import { InferenceSource } from '../ai'
import { SAMPLE_BULLETIN, SAMPLE_SHEET } from '../checker/fixtures/halimbawa'
import { checkDraft } from '../checker'
import { parseBulletin } from '../factsheet/parse'
import {
  DRAFT_CHECKS,
  approvalsCleared,
  attemptError,
  attemptText,
  bulletinReadText,
  cloudReadBlock,
  cloudReadError,
  missingFacts,
  readingLine,
  draftBlockReason,
  draftsCleared,
  firstLine,
  greeting,
  historySummary,
  isBusyError,
  openFactFields,
  progressText,
  stormSummary,
  tabStatus,
} from './create'
import type { Attempt } from './useDrafts'

const pim = { name: 'Pim Cabanlit', method: 'google' as const }

describe('greeting', () => {
  it('says good morning from 5 AM', () => {
    expect(greeting(5, pim)).toBe('Good morning, Pim')
  })

  it('says good afternoon from noon', () => {
    expect(greeting(12, pim)).toBe('Good afternoon, Pim')
  })

  it('says good evening from 6 PM', () => {
    expect(greeting(18, pim)).toBe('Good evening, Pim')
  })

  it('says good evening in the small hours', () => {
    expect(greeting(2, pim)).toBe('Good evening, Pim')
  })

  it('leaves the name out for the shared test officer', () => {
    expect(greeting(14, { name: '', method: 'password' })).toBe('Good afternoon')
  })

  it('leaves the name out when the Google profile has none', () => {
    expect(greeting(14, { name: '  ', method: 'google' })).toBe('Good afternoon')
  })
})

describe('stormSummary', () => {
  it('names the demo storm and its landfall date and time', () => {
    expect(stormSummary(SAMPLE_SHEET).line).toBe('Demo storm · Typhoon Sample · Landfall Nov 14, 6:00 PM')
  })

  it('gives the landfall time alone when the bulletin has no date', () => {
    const { landfallDate: _, ...sheet } = SAMPLE_SHEET
    expect(stormSummary(sheet).line).toBe('Demo storm · Typhoon Sample · Landfall 6:00 PM')
  })

  it('leaves out a storm name the officer left empty', () => {
    expect(stormSummary({ ...SAMPLE_SHEET, stormName: ' ' }).line).toBe('Demo storm · Landfall Nov 14, 6:00 PM')
  })

  it('lists each area with its signal, in the fact sheet’s order', () => {
    expect(stormSummary(SAMPLE_SHEET).areas).toEqual([
      { area: 'Purok 1', signal: 3 },
      { area: 'Purok Ilaya', signal: 3 },
      { area: 'Purok 2', signal: 2 },
    ])
  })
})

describe('openFactFields', () => {
  it('opens no fields when the bulletin gave every fact', () => {
    expect(openFactFields(parseBulletin(SAMPLE_BULLETIN).notFound)).toEqual([])
  })

  it('opens the fields for the facts the bulletin didn’t give', () => {
    const bulletin = 'Typhoon Sample. Signal No. 3 is raised over Purok 1. Landfall at 6:00 PM.'
    expect(openFactFields(parseBulletin(bulletin).notFound)).toEqual(['evacuationCentres', 'hotline'])
  })

  it('opens every field for a bulletin with none of the facts', () => {
    expect(openFactFields(parseBulletin('Nothing here.').notFound)).toEqual([
      'stormName',
      'signals',
      'landfallTime',
      'evacuationCentres',
      'hotline',
    ])
  })
})

describe('draftBlockReason', () => {
  const ready = { modelsReady: true, online: true, device: 'unavailable' as const, busy: false }

  it('lets the cloud draft when online', () => {
    expect(draftBlockReason(ready)).toBeUndefined()
  })

  it('lets the on-device model draft when offline', () => {
    expect(draftBlockReason({ ...ready, online: false, device: 'available' })).toBeUndefined()
  })

  it('says drafting waits for the connection when offline with no on-device model', () => {
    expect(draftBlockReason({ ...ready, online: false })).toMatch(/^Offline, and this laptop has no on-device model/)
  })

  it('says the model settings are loading before the models exist', () => {
    expect(draftBlockReason({ ...ready, modelsReady: false })).toBe('Loading the model settings…')
  })

  it('says one alert drafts at a time while another drafts', () => {
    expect(draftBlockReason({ ...ready, busy: true })).toBe('One alert drafts at a time. Wait for the one in progress.')
  })
})

describe('tabStatus', () => {
  it('is drafting while a draft streams in, whatever the last check said', () => {
    expect(tabStatus({ running: true, approved: false, passed: false })).toBe('drafting')
  })

  it('is approved once approved', () => {
    expect(tabStatus({ running: false, approved: true, passed: true })).toBe('approved')
  })

  it('is empty with no text to check', () => {
    expect(tabStatus({ running: false, approved: false, passed: undefined })).toBe('empty')
  })

  it('passes when the text passes the checks', () => {
    expect(tabStatus({ running: false, approved: false, passed: true })).toBe('passes')
  })

  it('fails when the text fails a check', () => {
    expect(tabStatus({ running: false, approved: false, passed: false })).toBe('fails')
  })
})

describe('DRAFT_CHECKS', () => {
  it('names every rule the checker applies to a draft', () => {
    const bad = checkDraft('[Name] Signal No. 4 at 9 PM in Purok 9, a severe typhoon. 🌀', SAMPLE_SHEET, {
      claimWords: ['severe'],
      area: 'Purok Ilaya',
    })
    const rules = new Set(bad.issues.map((i) => i.rule))
    expect([...rules].every((r) => DRAFT_CHECKS.some((c) => c.rule === r))).toBe(true)
    expect(DRAFT_CHECKS).toHaveLength(6)
  })
})

describe('isBusyError', () => {
  it('reads a 429 as busy', () => {
    expect(isBusyError('[429 Too Many Requests] Resource exhausted')).toBe(true)
  })

  it('reads a quota error as busy', () => {
    expect(isBusyError('Quota exceeded for quota metric')).toBe(true)
  })

  it('doesn’t read a network error as busy', () => {
    expect(isBusyError('Failed to fetch')).toBe(false)
  })
})

describe('attemptError', () => {
  it('says the cloud is busy for a quota error', () => {
    expect(attemptError('RESOURCE_EXHAUSTED')).toBe('The cloud is busy right now. Try again shortly.')
  })

  it('keeps any other error as it came', () => {
    expect(attemptError('Failed to fetch')).toBe('Failed to fetch')
  })
})

function attempt(over: Partial<Attempt>): Attempt {
  return { id: 1, route: 'prefer_on_device', area: 'Purok Ilaya', retry: false, prompt: '', startedAt: 0, text: '', ...over }
}

describe('progressText', () => {
  it('says the draft is on this laptop once Nano answers', () => {
    expect(progressText(attempt({ source: InferenceSource.ON_DEVICE }))).toBe('Drafting on this laptop')
  })

  it('says a cloud retry carries an edit per problem', () => {
    expect(progressText(attempt({ route: 'only_in_cloud', retry: true }))).toBe('Retrying in the cloud, with an edit per problem')
  })

  it('doesn’t guess where a draft runs before its first words', () => {
    expect(progressText(attempt({}))).toBe('Drafting')
  })
})

describe('attemptText', () => {
  it('counts the seconds of a running draft', () => {
    expect(attemptText(attempt({}), 12_400)).toBe('Draft · 12 s')
  })

  it('gives the time and the problems of a failed draft', () => {
    const issues = [{ rule: 'placeholders' as const, message: 'Placeholder' }, { rule: 'added-claims' as const, message: 'Severe' }]
    expect(attemptText(attempt({ endedMs: 14_230, passed: false, issues }), undefined)).toBe('Draft · 14.2 s · failed (2 problems)')
  })

  it('says a retry passed', () => {
    expect(attemptText(attempt({ retry: true, endedMs: 9_000, passed: true, issues: [] }), undefined)).toBe(
      'Retry with an edit per problem · 9.0 s · passed',
    )
  })

  it('says when the officer stopped waiting', () => {
    expect(attemptText(attempt({ endedMs: 31_000, abandoned: true }), undefined)).toBe('Draft · stopped waiting after 31.0 s')
  })

  it('says the cloud is busy for a quota error', () => {
    expect(attemptText(attempt({ route: 'only_in_cloud', endedMs: 800, error: '429 Too Many Requests' }), undefined)).toBe(
      'Draft · error after 0.8 s: The cloud is busy right now. Try again shortly.',
    )
  })
})

describe('historySummary', () => {
  it('folds a failed draft and a passing retry into one line', () => {
    const tries = [attempt({ endedMs: 1, passed: false }), attempt({ id: 2, endedMs: 1, passed: true })]
    expect(historySummary(tries)).toBe('2 tries: failed, then passed')
  })

  it('says one try for a single draft', () => {
    expect(historySummary([attempt({ endedMs: 1, passed: true })])).toBe('1 try: passed')
  })

  it('names a stop, an error and a draft still running', () => {
    const tries = [attempt({ endedMs: 1, abandoned: true }), attempt({ id: 2, endedMs: 1, error: 'x' }), attempt({ id: 3 })]
    expect(historySummary(tries)).toBe('3 tries: stopped waiting, then error, then drafting')
  })
})

describe('approvalsCleared', () => {
  it('says nothing when there were no approvals to clear', () => {
    expect(approvalsCleared('facts', 0)).toBeUndefined()
  })

  it('says one approval was cleared when the facts changed', () => {
    expect(approvalsCleared('facts', 1)).toBe(
      'The facts changed, so 1 approval was cleared. Saved alerts stay as they are until you approve new ones.',
    )
  })

  it('counts the approvals cleared when the area changed', () => {
    expect(approvalsCleared('area', 3)).toMatch(/^The area changed, so 3 approvals were cleared\./)
  })

  it('says the facts need confirming again when the officer unticks the box', () => {
    expect(approvalsCleared('unconfirmed', 2)).toMatch(/^The facts need confirming again, so 2 approvals were cleared\./)
  })
})

describe('draftsCleared', () => {
  it('says nothing when there were no drafts', () => {
    expect(draftsCleared(0)).toBeUndefined()
  })

  it('counts the drafts a second reading cleared', () => {
    expect(draftsCleared(4)).toBe('Bulletin read again, so the 4 drafts were cleared. Saved alerts stay as they are until you approve new ones.')
  })
})

describe('firstLine', () => {
  it('gives the bulletin’s first line', () => {
    expect(firstLine(SAMPLE_BULLETIN)).toBe('DEMO BULLETIN (fictional). Typhoon Sample.')
  })

  it('skips blank lines before it', () => {
    expect(firstLine('\n\n  Typhoon Sample.\nSignal No. 3')).toBe('Typhoon Sample.')
  })
})

describe('reading a bulletin in the cloud', () => {
  const can = { online: true, modelReady: true, busy: false, length: 500, maxLength: 20000 }

  it('opens the landfall date for the officer when the cloud’s date was left out', () => {
    expect(openFactFields(['landfall date'])).toEqual(['landfallDate'])
  })

  it('names each fact to fill in once, whether not found or left out', () => {
    const unconfirmed = [
      { fact: 'hotline' as const, message: 'a' },
      { fact: 'signal numbers' as const, message: 'b' },
      { fact: 'signal numbers' as const, message: 'c' },
    ]
    expect(missingFacts(['storm name', 'hotline'], unconfirmed)).toEqual(['storm name', 'hotline', 'signal numbers'])
  })

  it.each([
    ['code', 0, 'Bulletin read. Every fact was found.'],
    ['code', 3, 'Bulletin read. 3 facts weren’t found.'],
    ['cloud', 0, 'Read in the cloud. Every fact was confirmed.'],
    ['cloud', 1, 'Read in the cloud. 1 fact to check.'],
  ] as const)('says what reading by %s left with %i facts missing', (by, missing, text) => {
    expect(bulletinReadText(by, missing)).toBe(text)
  })

  it('can read when online, with the model loaded and no draft running', () => {
    expect(cloudReadBlock(can)).toBeUndefined()
  })

  it('says offline first, since nothing else matters without a connection', () => {
    expect(cloudReadBlock({ ...can, online: false, modelReady: false })).toBe('Reading in the cloud needs a connection.')
  })

  it('refuses a bulletin longer than a saved alert can keep', () => {
    expect(cloudReadBlock({ ...can, length: 20001 })).toMatch(/^The bulletin is over 20,000 characters/)
  })

  it('waits for a draft in progress, since reading replaces the facts it uses', () => {
    expect(cloudReadBlock({ ...can, busy: true })).toBe('Wait for the draft in progress.')
  })

  it('says the cloud took too long when the call timed out', () => {
    const timeout = new DOMException('signal timed out', 'TimeoutError')
    expect(cloudReadError(timeout)).toBe('The cloud took longer than 60 s, so it was stopped. Try again, or fill the facts in by hand.')
  })

  it('says the cloud is busy for a quota error', () => {
    expect(cloudReadError(new Error('[429] Resource exhausted'))).toBe('The cloud is busy right now. Try again shortly.')
  })

  it('shows any other error as it is', () => {
    expect(cloudReadError(new Error('App Check token is invalid'))).toBe('The cloud didn’t read it: App Check token is invalid')
  })

  it('counts the seconds while the cloud reads', () => {
    expect(readingLine('code', { state: 'reading', startedAt: 1000 }, 4400)).toBe('Reading in the cloud · 3 s')
  })

  it('says plain code read it, with no AI', () => {
    expect(readingLine('code', { state: 'idle' }, 0)).toBe('Read by plain code on this laptop, with no AI.')
  })

  it('names the cloud model and its time, and that code kept only confirmed facts', () => {
    expect(readingLine('cloud', { state: 'read', seconds: 2.44, cloudModel: 'gemini-3.5-flash-lite' }, 0)).toBe(
      'Read in the cloud by gemini-3.5-flash-lite in 2.4 s. Code kept only the facts it found in the bulletin’s own words.',
    )
  })

  it('keeps saying the cloud read the facts after a later try fails', () => {
    expect(readingLine('cloud', { state: 'failed', error: 'x' }, 0)).toBe(
      'Read in the cloud. Code kept only the facts it found in the bulletin’s own words.',
    )
  })
})
