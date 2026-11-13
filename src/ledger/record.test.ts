import { describe, expect, it } from 'vitest'
import { approvedAlert, type SavedAlert } from '../alerts/record'
import { GOOD_DRAFT, SAMPLE_SHEET } from '../checker/fixtures/halimbawa'
import { CHECKER_CLAIM_WORDS } from '../config/defaults'
import { HOUSEHOLDS } from '../drafting/households'
import { LEDGER_LIMITS, approvalWrites, clip, readLedgerEntry, withdrawalWrites, type LedgerDraft, type Trail } from './record'

const general = HOUSEHOLDS.find((h) => h.id === 'general')!
const LEDGER_ID = 'AbCdEfGhIjKlMnOpQrSt'

function approval() {
  const result = approvedAlert({
    text: GOOD_DRAFT,
    sheet: SAMPLE_SHEET,
    area: 'Purok Ilaya',
    household: general,
    claimWords: [...CHECKER_CLAIM_WORDS],
    source: 'on_device',
    edited: false,
  })
  if (!result.ok) throw new Error(result.reason)
  return result
}

const nanoDraft: LedgerDraft = {
  round: 1,
  route: 'prefer_on_device',
  retry: false,
  area: 'Purok Ilaya',
  source: 'on_device',
  prompt: 'Write a typhoon alert…',
  text: GOOD_DRAFT,
  outcome: 'passed',
  issues: [],
  error: '',
  startedAtMs: 1_794_700_000_000,
  firstTextMs: 900,
  totalMs: 15_200,
}

const trail: Trail = { drafts: [nanoDraft], cloudModel: 'gemini-3.5-flash-lite', claimWords: [...CHECKER_CLAIM_WORDS] }

describe('approvalWrites', () => {
  it('gives residents a copy with the alert’s text and place, and no officer or bulletin', () => {
    const writes = approvalWrites(approval(), LEDGER_ID, trail)
    expect(writes.copy).toEqual({
      household: 'general',
      area: 'Purok Ilaya',
      areaKey: 'purok-ilaya',
      signal: approval().record.signal,
      stormName: SAMPLE_SHEET.stormName,
      text: GOOD_DRAFT,
      status: 'active',
    })
  })

  it('points the alert at its ledger entry', () => {
    const writes = approvalWrites(approval(), LEDGER_ID, trail)
    expect(writes.alertId).toBe('general__purok-ilaya')
    expect(writes.alert).toEqual({ ...approval().record, ledgerId: LEDGER_ID })
  })

  it('gives the entry the same alert fields, the drafts, the cloud model and the claim words', () => {
    const { entry } = approvalWrites(approval(), LEDGER_ID, trail)
    expect(entry).toEqual({
      kind: 'approved',
      alertId: 'general__purok-ilaya',
      ...approval().record,
      cloudModel: 'gemini-3.5-flash-lite',
      claimWords: [...CHECKER_CLAIM_WORDS],
      drafts: [nanoDraft],
      draftsOmitted: 0,
    })
  })

  it('keeps only the latest drafts over the limit, and counts the ones left out', () => {
    const drafts = Array.from({ length: LEDGER_LIMITS.drafts + 3 }, (_, i) => ({ ...nanoDraft, round: i + 1 }))
    const { entry } = approvalWrites(approval(), LEDGER_ID, { ...trail, drafts })
    expect(entry.drafts).toHaveLength(LEDGER_LIMITS.drafts)
    expect(entry.drafts[0]?.round).toBe(4)
    expect(entry.draftsOmitted).toBe(3)
  })

  it('cuts a very long model answer and says it was cut', () => {
    const long = { ...nanoDraft, text: 'a'.repeat(LEDGER_LIMITS.draftText + 50) }
    const [kept] = approvalWrites(approval(), LEDGER_ID, { ...trail, drafts: [long] }).entry.drafts
    expect(kept?.text).toHaveLength(LEDGER_LIMITS.draftText)
    expect(kept?.text.endsWith(' … (cut)')).toBe(true)
  })

  it('keeps at most the limit of issues per draft', () => {
    const issues = Array.from({ length: LEDGER_LIMITS.issues + 5 }, () => ({ rule: 'figures' as const, message: 'x' }))
    const [kept] = approvalWrites(approval(), LEDGER_ID, { ...trail, drafts: [{ ...nanoDraft, issues }] }).entry.drafts
    expect(kept?.issues).toHaveLength(LEDGER_LIMITS.issues)
  })

  it('records an alert typed by hand with no drafts', () => {
    const { entry } = approvalWrites(approval(), LEDGER_ID, { ...trail, drafts: [] })
    expect([entry.drafts, entry.draftsOmitted]).toEqual([[], 0])
  })
})

describe('clip', () => {
  it('leaves text within the limit as it is', () => {
    expect(clip('Leave now.', 10)).toBe('Leave now.')
  })

  it('cuts text over the limit to exactly the limit, ending with a note', () => {
    expect(clip('a'.repeat(30), 20)).toBe('a'.repeat(12) + ' … (cut)')
  })
})

describe('readLedgerEntry', () => {
  const { entry } = approvalWrites(approval(), LEDGER_ID, trail)
  const data = { ...entry, by: 'officer-1', at: 'server time' }
  const at = new Date('2026-11-14T08:00:00Z')

  it('reads an approval entry with its time and upload state', () => {
    expect(readLedgerEntry(LEDGER_ID, data, at, true)).toEqual({
      id: LEDGER_ID,
      kind: 'approved',
      alertId: 'general__purok-ilaya',
      household: 'general',
      area: 'Purok Ilaya',
      signal: 3,
      text: GOOD_DRAFT,
      source: 'on_device',
      edited: false,
      factSheet: SAMPLE_SHEET,
      cloudModel: 'gemini-3.5-flash-lite',
      drafts: [nanoDraft],
      draftsOmitted: 0,
      by: 'officer-1',
      at,
      pending: true,
    })
  })

  it('ignores a kind of entry this app doesn’t write yet', () => {
    expect(readLedgerEntry(LEDGER_ID, { ...data, kind: 'translated' }, at, false)).toBeUndefined()
  })

  it('ignores an entry with a draft it can’t read', () => {
    expect(readLedgerEntry(LEDGER_ID, { ...data, drafts: [{ ...nanoDraft, outcome: 'maybe' }] }, at, false)).toBeUndefined()
  })

  it('ignores an entry with no fact sheet', () => {
    const { factSheet: _sheet, ...noSheet } = data
    expect(readLedgerEntry(LEDGER_ID, noSheet, at, false)).toBeUndefined()
  })
})

describe('withdrawalWrites', () => {
  const WITHDRAWAL_ID = 'WithdrawWithdraw0001'
  const saved: SavedAlert = {
    id: 'general__purok-ilaya',
    household: 'general',
    area: 'Purok Ilaya',
    text: GOOD_DRAFT,
    source: 'on_device',
    edited: false,
    approvedAt: new Date('2026-11-14T08:00:00Z'),
    pending: false,
    ledgerId: LEDGER_ID,
    withdrawn: undefined,
  }

  it('points the alert at the withdrawal’s entry and nothing else', () => {
    const writes = withdrawalWrites(saved, WITHDRAWAL_ID, 'Wrong area.')
    if (!writes.ok) throw new Error(writes.reason)
    expect(writes.alertId).toBe('general__purok-ilaya')
    expect(writes.withdrawal).toEqual({ ledgerId: WITHDRAWAL_ID })
  })

  it('gives residents a copy that says the alert is withdrawn, without its text', () => {
    const writes = withdrawalWrites(saved, WITHDRAWAL_ID, 'Wrong area.')
    if (!writes.ok) throw new Error(writes.reason)
    expect(writes.copy).toEqual({ household: 'general', area: 'Purok Ilaya', areaKey: 'purok-ilaya', status: 'withdrawn' })
  })

  it('records the withdrawn text, the approval it withdraws and the reason', () => {
    const writes = withdrawalWrites(saved, WITHDRAWAL_ID, 'Wrong area.')
    if (!writes.ok) throw new Error(writes.reason)
    expect(writes.ledgerId).toBe(WITHDRAWAL_ID)
    expect(writes.entry).toEqual({
      kind: 'withdrawn',
      alertId: 'general__purok-ilaya',
      household: 'general',
      area: 'Purok Ilaya',
      text: GOOD_DRAFT,
      approvalId: LEDGER_ID,
      reason: 'Wrong area.',
    })
  })

  it('trims spaces around the reason', () => {
    const writes = withdrawalWrites(saved, WITHDRAWAL_ID, '  Wrong area.\n')
    expect(writes.ok && writes.entry.reason).toBe('Wrong area.')
  })

  it('records an empty approval for an alert saved before the ledger', () => {
    const writes = withdrawalWrites({ ...saved, ledgerId: undefined }, WITHDRAWAL_ID, 'Old alert.')
    expect(writes.ok && writes.entry.approvalId).toBe('')
  })

  it('refuses an alert that is already withdrawn', () => {
    const withdrawn = { ...saved, withdrawn: { ledgerId: 'OldWithdrawal0000001', by: 'officer-1', at: undefined } }
    expect(withdrawalWrites(withdrawn, WITHDRAWAL_ID, 'Again.')).toEqual({ ok: false, reason: 'This alert is already withdrawn.' })
  })

  it('refuses a reason that is only spaces', () => {
    const writes = withdrawalWrites(saved, WITHDRAWAL_ID, '   ')
    expect(writes.ok).toBe(false)
    expect(!writes.ok && writes.reason).toContain('Say why')
  })

  it('refuses a reason over the limit', () => {
    const writes = withdrawalWrites(saved, WITHDRAWAL_ID, 'x'.repeat(LEDGER_LIMITS.reason + 1))
    expect(!writes.ok && writes.reason).toContain('too long')
  })

  it('accepts a reason exactly at the limit', () => {
    expect(withdrawalWrites(saved, WITHDRAWAL_ID, 'x'.repeat(LEDGER_LIMITS.reason)).ok).toBe(true)
  })
})

describe('readLedgerEntry for a withdrawal', () => {
  const data = {
    kind: 'withdrawn',
    alertId: 'general__purok-ilaya',
    household: 'general',
    area: 'Purok Ilaya',
    text: GOOD_DRAFT,
    approvalId: LEDGER_ID,
    reason: 'Wrong area.',
    by: 'officer-1',
    at: 'server time',
  }
  const at = new Date('2026-11-14T09:00:00Z')

  it('reads a withdrawal entry with its reason, time and upload state', () => {
    expect(readLedgerEntry('WithdrawWithdraw0001', data, at, false)).toEqual({
      id: 'WithdrawWithdraw0001',
      kind: 'withdrawn',
      alertId: 'general__purok-ilaya',
      household: 'general',
      area: 'Purok Ilaya',
      text: GOOD_DRAFT,
      approvalId: LEDGER_ID,
      reason: 'Wrong area.',
      by: 'officer-1',
      at,
      pending: false,
    })
  })

  it('ignores a withdrawal entry with no reason', () => {
    const { reason: _reason, ...noReason } = data
    expect(readLedgerEntry('WithdrawWithdraw0001', noReason, at, false)).toBeUndefined()
  })

  it('ignores a withdrawal entry with an unknown household', () => {
    expect(readLedgerEntry('WithdrawWithdraw0001', { ...data, household: 'tourists' }, at, false)).toBeUndefined()
  })
})
