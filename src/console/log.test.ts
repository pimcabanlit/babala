import { describe, expect, it } from 'vitest'
import { HOUSEHOLDS } from '../drafting/households'
import { attemptLog } from './log'
import type { Draft } from './useDrafts'

const failed: Draft = {
  text: 'Fixed text.',
  running: false,
  approved: false,
  edited: true,
  history: [],
  recordedThrough: 0,
  attempts: [
    {
      id: 1,
      route: 'prefer_on_device',
      area: 'Purok 1',
      retry: false,
      prompt: 'PROMPT 1',
      startedAt: 0,
      endedMs: 5400,
      text: 'Leave tonight.',
      source: 'on_device',
      passed: false,
      issues: [{ rule: 'added-claims', message: '“tonight” is not in the bulletin.' }],
    },
    { id: 2, route: 'only_in_cloud', area: 'Purok 1', retry: true, prompt: 'PROMPT 2', startedAt: 0, endedMs: 1000, text: '', error: 'boom' },
  ],
}

describe('attemptLog', () => {
  it('lists each attempt with its prompt, answer and problems, skipping households not drafted', () => {
    const drafts: Record<string, Draft> = Object.fromEntries(HOUSEHOLDS.map((h) => [h.id, { ...failed, attempts: [] }]))
    drafts.seniors = failed
    const log = attemptLog(HOUSEHOLDS, drafts, { area: 'Purok 1', cloudModel: 'm', device: 'available', warmUp: 'warmed up' }, new Date(0))
    expect(log).toBe(
      [
        'Babala test log · 1970-01-01T00:00:00.000Z',
        'Area: Purok 1 · cloud model: m · on-device: available · warmed up',
        '',
        '== Seniors ==',
        '',
        '1. prefer_on_device → on_device · draft · 5.4 s · failed',
        'Prompt:',
        'PROMPT 1',
        'Answer:',
        'Leave tonight.',
        'Problems:',
        '- “tonight” is not in the bulletin.',
        '',
        '2. only_in_cloud → unknown source · retry · 1.0 s · error: boom',
        'Prompt:',
        'PROMPT 2',
        'Answer:',
        '(none)',
        '',
        'Then edited by hand.',
      ].join('\n'),
    )
  })

  it('shows the model’s JSON under the joined alert when they differ', () => {
    const json = '{"signal_and_landfall":"A.","what_to_do_and_where_to_go":"B."}'
    const draft: Draft = {
      ...failed,
      edited: false,
      attempts: [{ ...failed.attempts[0], text: 'A. B.', raw: `${json}\n`, issues: [] }],
    }
    const log = attemptLog(HOUSEHOLDS, { general: draft }, { area: 'Purok 1', cloudModel: 'm', device: 'available', warmUp: 'w' }, new Date(0))
    expect(log).toContain(['Answer:', 'A. B.', 'Raw answer:', json].join('\n'))
    const plain = { ...draft, attempts: [{ ...draft.attempts[0], text: 'Leave.', raw: 'Leave.\n' }] }
    expect(attemptLog(HOUSEHOLDS, { general: plain }, { area: 'Purok 1', cloudModel: 'm', device: 'available', warmUp: 'w' })).not.toContain('Raw answer')
  })
})
