import { describe, expect, it } from 'vitest'
import type { SavedAlert } from '../alerts/record'
import type { LedgerDraft, LedgerEntry } from '../ledger/record'
import { approverLabel, draftLine, entryStatus, writerLabel } from './ledgerView'

const approval = { id: 'entry-2', kind: 'approved', alertId: 'general__purok-ilaya' } as LedgerEntry
const withdrawal = { id: 'entry-3', kind: 'withdrawn', alertId: 'general__purok-ilaya' } as LedgerEntry

const alert: SavedAlert = {
  id: 'general__purok-ilaya',
  household: 'general',
  area: 'Purok Ilaya',
  text: 'Signal No. 3 is up over Purok Ilaya.',
  source: 'on_device',
  edited: false,
  approvedAt: undefined,
  pending: false,
  ledgerId: 'entry-2',
  withdrawn: undefined,
}

function saved(a: SavedAlert): Map<string, SavedAlert> {
  return new Map([[a.id, a]])
}

const withdrawnByEntry3 = { ...alert, withdrawn: { ledgerId: 'entry-3', by: 'uid', at: undefined } }

describe('entryStatus', () => {
  it('says current when the saved alert points at this approval', () => {
    expect(entryStatus(approval, saved(alert))).toBe('current')
  })

  it('says replaced when the saved alert points at a later approval', () => {
    expect(entryStatus(approval, saved({ ...alert, ledgerId: 'entry-4' }))).toBe('replaced')
  })

  it('says replaced when the saved alert was approved before the ledger existed', () => {
    expect(entryStatus(approval, saved({ ...alert, ledgerId: undefined }))).toBe('replaced')
  })

  it('says withdrawn when the approval’s alert was then withdrawn', () => {
    expect(entryStatus(approval, saved(withdrawnByEntry3))).toBe('withdrawn')
  })

  it('says current for the withdrawal the saved alert points at', () => {
    expect(entryStatus(withdrawal, saved(withdrawnByEntry3))).toBe('current')
  })

  it('says replaced for a withdrawal once a new approval cleared it', () => {
    expect(entryStatus(withdrawal, saved({ ...alert, ledgerId: 'entry-4' }))).toBe('replaced')
  })

  it('says replaced for a withdrawal of an earlier approval that was then withdrawn again', () => {
    const again = { ...alert, ledgerId: 'entry-4', withdrawn: { ledgerId: 'entry-5', by: 'uid', at: undefined } }
    expect(entryStatus(withdrawal, saved(again))).toBe('replaced')
  })

  it('says unknown while the saved alerts are still loading', () => {
    expect(entryStatus(approval, undefined)).toBe('unknown')
  })

  it('says unknown when the alert isn’t among the saved alerts', () => {
    expect(entryStatus(approval, new Map())).toBe('unknown')
  })
})

describe('approverLabel', () => {
  it('says you for the signed-in officer', () => {
    expect(approverLabel('uid-123456789', 'uid-123456789')).toBe('you')
  })

  it('shows only the start of another officer’s user ID', () => {
    expect(approverLabel('abcdef123456789', 'me')).toBe('another officer (ID abcdef…)')
  })
})

describe('writerLabel', () => {
  it('names the cloud model for a cloud draft', () => {
    expect(writerLabel('in_cloud', 'gemini-3.5-flash-lite')).toBe('the cloud (gemini-3.5-flash-lite)')
  })

  it('says the officer wrote an alert typed by hand', () => {
    expect(writerLabel('none', 'gemini-3.5-flash-lite')).toBe('the officer, by hand')
  })
})

describe('draftLine', () => {
  const d: LedgerDraft = {
    round: 1,
    route: 'prefer_on_device',
    retry: false,
    area: 'Purok Ilaya',
    source: 'on_device',
    prompt: '',
    text: '',
    outcome: 'failed',
    issues: [{ rule: 'added-claims', message: '“safe” is not in the bulletin.' }],
    error: '',
    startedAtMs: 0,
    firstTextMs: 700,
    totalMs: 15_240,
  }

  it('gives the round, model, time and how many problems the checker found', () => {
    expect(draftLine(d, 'm')).toBe('Round 1 · draft · Gemini Nano on the laptop · 15.2 s · failed the checker (1 problem)')
  })

  it('names the cloud model for a cloud retry that passed', () => {
    const cloud = { ...d, round: 2, retry: true, route: 'only_in_cloud' as const, source: 'in_cloud' as const, outcome: 'passed' as const }
    expect(draftLine(cloud, 'gemini-3.5-flash-lite')).toBe(
      'Round 2 · retry with an edit per problem · cloud, gemini-3.5-flash-lite · 15.2 s · passed the checker',
    )
  })

  it('says when the officer stopped waiting for the laptop', () => {
    expect(draftLine({ ...d, outcome: 'stopped', issues: [] }, 'm')).toContain('stopped waiting, moved to the cloud')
  })
})
