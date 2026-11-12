import { describe, expect, it } from 'vitest'
import { unrecordedDrafts, writtenBy } from './approval'
import type { Attempt, Draft } from './useDrafts'

const attempt = (a: Partial<Attempt>): Attempt => ({
  id: 1,
  route: 'prefer_on_device',
  area: 'Purok Ilaya',
  retry: false,
  prompt: 'prompt',
  startedAt: 0,
  endedMs: 15000,
  text: 'Alert text.',
  source: 'on_device',
  ...a,
})
const draft = (attempts: Attempt[], more: Partial<Draft> = {}): Draft => ({
  text: 'Alert text.',
  attempts,
  running: false,
  approved: false,
  history: [],
  recordedThrough: 0,
  ...more,
})

describe('writtenBy', () => {
  it('names the laptop when Nano wrote the last draft', () => {
    expect(writtenBy(draft([attempt({})]))).toBe('on_device')
  })

  it('names the cloud when the retry in the cloud wrote the last draft', () => {
    expect(writtenBy(draft([attempt({}), attempt({ id: 2, route: 'only_in_cloud', source: 'in_cloud' })]))).toBe('in_cloud')
  })

  it('skips an abandoned cloud attempt and names the laptop draft before it', () => {
    expect(writtenBy(draft([attempt({}), attempt({ id: 2, source: 'in_cloud', abandoned: true, text: '' })]))).toBe('on_device')
  })

  it('skips an attempt that ended in an error', () => {
    expect(writtenBy(draft([attempt({ source: 'in_cloud' }), attempt({ id: 2, error: 'quota', text: '' })]))).toBe('in_cloud')
  })

  it('says none when the officer typed the alert with no model attempt', () => {
    expect(writtenBy(draft([]))).toBe('none')
  })

  it('says unknown when the SDK did not report the source', () => {
    expect(writtenBy(draft([attempt({ source: undefined })]))).toBe('unknown')
  })
})

describe('unrecordedDrafts', () => {
  const failed = attempt({ id: 1, passed: false, text: 'Leave tonight.', issues: [{ rule: 'added-claims', message: '“tonight” is not in the bulletin.' }] })
  const passed = attempt({ id: 2, retry: true, passed: true, firstTextMs: 800 })

  it('turns each finished attempt into a ledger draft with its model, verdict and timings', () => {
    expect(unrecordedDrafts(draft([failed, passed]))).toEqual({
      through: 2,
      drafts: [
        {
          round: 1,
          route: 'prefer_on_device',
          retry: false,
          area: 'Purok Ilaya',
          source: 'on_device',
          prompt: 'prompt',
          text: 'Leave tonight.',
          outcome: 'failed',
          issues: [{ rule: 'added-claims', message: '“tonight” is not in the bulletin.' }],
          error: '',
          startedAtMs: 0,
          firstTextMs: null,
          totalMs: 15000,
        },
        expect.objectContaining({ round: 1, retry: true, outcome: 'passed', issues: [], firstTextMs: 800 }),
      ],
    })
  })

  it('keeps the rounds before “Draft again”, numbered in order', () => {
    const earlier = attempt({ id: 1, passed: false })
    const result = unrecordedDrafts(draft([attempt({ id: 2, passed: true })], { history: [[earlier]] }))
    expect(result.drafts.map((d) => d.round)).toEqual([1, 2])
    expect(result.through).toBe(2)
  })

  it('leaves out attempts already kept in an earlier approval’s entry', () => {
    const result = unrecordedDrafts(draft([attempt({ id: 3, passed: true })], { history: [[failed, passed]], recordedThrough: 2 }))
    expect(result.drafts).toEqual([expect.objectContaining({ round: 2, outcome: 'passed' })])
  })

  it('has no drafts after an approval when the officer only edited the text', () => {
    expect(unrecordedDrafts(draft([failed, passed], { recordedThrough: 2 }))).toEqual({ drafts: [], through: 2 })
  })

  it('records a call the officer stopped waiting for, and one that threw', () => {
    const stopped = attempt({ id: 1, abandoned: true, text: '' })
    const threw = attempt({ id: 2, route: 'only_in_cloud', error: 'quota exceeded', text: '', source: undefined })
    const result = unrecordedDrafts(draft([stopped, threw]))
    expect(result.drafts.map((d) => [d.outcome, d.error, d.source])).toEqual([
      ['stopped', '', 'on_device'],
      ['error', 'quota exceeded', 'unknown'],
    ])
  })

  it('lists the checker’s problems in reading order, without their spans', () => {
    const issues = [
      { rule: 'missing' as const, message: 'Missing the hotline.' },
      { rule: 'added-claims' as const, message: '“severe” is not in the bulletin.', span: { start: 4, end: 10, text: 'severe' } },
    ]
    const [d] = unrecordedDrafts(draft([attempt({ passed: false, issues })])).drafts
    expect(d?.issues).toEqual([
      { rule: 'added-claims', message: '“severe” is not in the bulletin.' },
      { rule: 'missing', message: 'Missing the hotline.' },
    ])
  })

  it('skips an attempt that is still streaming', () => {
    expect(unrecordedDrafts(draft([attempt({ endedMs: undefined })])).drafts).toEqual([])
  })
})
