import { describe, expect, it } from 'vitest'
import type { SavedAlert } from '../alerts/record'
import { GOOD_CEBUANO, GOOD_DRAFT, GOOD_FILIPINO, SAMPLE_SHEET } from '../checker/fixtures/halimbawa'
import { CHECKER_CLAIM_WORDS, TRANSLATION_CLAIMS } from '../config/defaults'
import { LEDGER_LIMITS, type LedgerDraft } from '../ledger/record'
import { readPublishedTranslations, translationWrites, type TranslationInput } from './record'

const APPROVAL_ID = 'AbCdEfGhIjKlMnOpQrSt'
const TRANSLATION_ID = 'TranslateTranslate01'

const saved: SavedAlert = {
  id: 'general__purok-ilaya',
  household: 'general',
  area: 'Purok Ilaya',
  text: GOOD_DRAFT,
  source: 'on_device',
  edited: false,
  approvedAt: new Date('2026-11-14T08:00:00Z'),
  pending: false,
  ledgerId: APPROVAL_ID,
  withdrawn: undefined,
  factSheet: SAMPLE_SHEET,
}

const cloudCall: LedgerDraft = {
  round: 1,
  route: 'only_in_cloud',
  retry: false,
  area: 'Purok Ilaya',
  source: 'in_cloud',
  prompt: 'Translate this typhoon alert…',
  text: GOOD_FILIPINO,
  outcome: 'passed',
  issues: [],
  error: '',
  startedAtMs: 1_794_700_100_000,
  firstTextMs: null,
  totalMs: 2_100,
}

const input: TranslationInput = {
  saved,
  lang: 'fil',
  text: `  ${GOOD_FILIPINO} `,
  source: 'in_cloud',
  edited: false,
  trail: {
    drafts: [cloudCall],
    cloudModel: 'gemini-3.5-flash-lite',
    claimWords: [...CHECKER_CLAIM_WORDS],
    translatedClaims: [...TRANSLATION_CLAIMS.fil],
  },
}

const reasonFor = (changed: Partial<TranslationInput>) => {
  const result = translationWrites({ ...input, ...changed }, TRANSLATION_ID)
  return result.ok ? undefined : result.reason
}

describe('translationWrites', () => {
  it('builds the resident’s translation and its entry against the saved English alert and approval', () => {
    const result = translationWrites(input, TRANSLATION_ID)
    expect(result.ok && [result.alertId, result.translation, result.entry.approvalId, result.entry.english, result.entry.text]).toEqual([
      'general__purok-ilaya',
      { text: GOOD_FILIPINO, ledgerId: TRANSLATION_ID },
      APPROVAL_ID,
      GOOD_DRAFT,
      GOOD_FILIPINO,
    ])
  })

  it('records the cloud calls, the model and both word lists in the entry', () => {
    const result = translationWrites(input, TRANSLATION_ID)
    expect(result.ok && [result.entry.drafts, result.entry.cloudModel, result.entry.translatedClaims.length]).toEqual([
      [cloudCall],
      'gemini-3.5-flash-lite',
      TRANSLATION_CLAIMS.fil.length,
    ])
  })

  it('keeps only the latest cloud calls, counting the rest', () => {
    const drafts = Array.from({ length: LEDGER_LIMITS.drafts + 2 }, (_, i) => ({ ...cloudCall, round: i + 1 }))
    const result = translationWrites({ ...input, trail: { ...input.trail, drafts } }, TRANSLATION_ID)
    expect(result.ok && [result.entry.drafts[0].round, result.entry.draftsOmitted]).toEqual([3, 2])
  })

  it('checks the text again and refuses a translation that fails, saying why', () => {
    expect(reasonFor({ text: GOOD_FILIPINO.replace('alas-6', 'alas-7') })).toBe(
      'The translation fails the checker: The translation lost “6 PM” from the English alert.',
    )
  })

  it('checks each language with its own claim words', () => {
    const kuyaw = GOOD_CEBUANO.replace('ang bagyo', 'ang kuyaw nga bagyo')
    const cebuano = { ...input.trail, translatedClaims: [...TRANSLATION_CLAIMS.ceb] }
    expect(reasonFor({ lang: 'ceb', text: kuyaw, trail: cebuano })).toBe(
      'The translation fails the checker: “kuyaw” (“danger”) is not in the English alert.',
    )
  })

  it('refuses a withdrawn alert', () => {
    expect(reasonFor({ saved: { ...saved, withdrawn: { ledgerId: 'Withdrawal0000000001', by: 'officer-1', at: undefined } } })).toBe(
      'This alert is withdrawn, so residents don’t get it or its translations.',
    )
  })

  it('refuses an alert saved before the ledger, which has no approval to translate', () => {
    expect(reasonFor({ saved: { ...saved, ledgerId: undefined } })).toBe(
      'This alert was saved before the ledger. Approve it again, then translate it.',
    )
  })

  it('refuses an alert that hasn’t uploaded yet', () => {
    expect(reasonFor({ saved: { ...saved, pending: true } })).toBe('This alert hasn’t uploaded yet. Translate it once it has.')
  })

  it('refuses while a word list is empty, which would let every claim through', () => {
    expect(reasonFor({ trail: { ...input.trail, translatedClaims: [] } })).toBe(
      'The checker’s word lists haven’t loaded yet. Try again in a moment.',
    )
  })
})

describe('readPublishedTranslations', () => {
  const fil = { text: GOOD_FILIPINO, ledgerId: TRANSLATION_ID }

  it('reads each language on an active copy, with its upload state', () => {
    expect(readPublishedTranslations({ status: 'active', translations: { fil } }, true)).toEqual({ fil: { ...fil, pending: true } })
  })

  it('reads nothing from a withdrawn copy', () => {
    expect(readPublishedTranslations({ status: 'withdrawn', translations: { fil } }, false)).toEqual({})
  })

  it('leaves out a language it doesn’t publish or can’t read', () => {
    const translations = { tl: fil, ceb: { text: 42, ledgerId: TRANSLATION_ID } }
    expect(readPublishedTranslations({ status: 'active', translations }, false)).toEqual({})
  })
})
