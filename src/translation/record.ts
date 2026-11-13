/**
 * Publishing a translation of a saved alert. Residents read it on the alert's
 * resident copy, `residentAlerts/{alertId}`, as `translations.{lang}`:
 * { text, ledgerId }. The officer's approval writes it there together with a
 * `translated` ledger entry, in one batch, and firestore.rules refuses either
 * one without the other.
 *
 * A new approval or a withdrawal rewrites the resident copy without
 * translations, so residents never get a translation of an English alert that
 * was replaced or withdrawn.
 *
 * Pure code, so the console and the rules tests build exactly the same
 * documents. firestore.rules checks the same fields and limits. Change both together.
 */
import type { SavedAlert } from '../alerts/record'
import { checkTranslation, type TranslatedClaim } from '../checker'
import { LEDGER_LIMITS, clip, clipDraft, type LedgerDraft, type TranslatedEntry, type TranslationSource } from '../ledger/record'
import { LANGUAGE_CODES, type LanguageCode } from './languages'

/** Size limit of a translation's text, the same as in firestore.rules. Filipino and Cebuano run longer than English. */
export const TRANSLATION_TEXT_LIMIT = 1500

/** What residents read for one language, on the resident copy. */
export type PublishedTranslation = {
  /** The translation exactly as the checker passed it and the officer approved it. */
  text: string
  /** The `translated` ledger entry that records it. Residents can't read the ledger; the rules use it. */
  ledgerId: string
}

/** What the console knows about the translation, besides its text. */
export type TranslationTrail = {
  drafts: LedgerDraft[]
  cloudModel: string
  claimWords: string[]
  translatedClaims: TranslatedClaim[]
}

export type TranslationInput = {
  saved: SavedAlert
  lang: LanguageCode
  text: string
  source: TranslationSource
  edited: boolean
  trail: TranslationTrail
}

export type TranslationWrites = {
  alertId: string
  lang: LanguageCode
  translation: PublishedTranslation
  ledgerId: string
  entry: TranslatedEntry
}

export type Publication = ({ ok: true } & TranslationWrites) | { ok: false; reason: string }

/**
 * The two writes that publish a translation, or why it can't be published.
 * It runs the checker again on the exact text against the saved English alert
 * and its fact sheet, so no path publishes a translation that fails it. The
 * store adds who published it and the server's time to the entry.
 */
export function translationWrites(input: TranslationInput, ledgerId: string): Publication {
  const { saved, lang, trail } = input
  const text = input.text.trim()
  const refuse = (reason: string): Publication => ({ ok: false, reason })

  if (saved.withdrawn) return refuse('This alert is withdrawn, so residents don’t get it or its translations.')
  if (!saved.ledgerId) return refuse('This alert was saved before the ledger. Approve it again, then translate it.')
  if (saved.pending) return refuse('This alert hasn’t uploaded yet. Translate it once it has.')
  if (!saved.factSheet) return refuse('This alert’s fact sheet can’t be read, so the translation can’t be checked.')
  if (text === '') return refuse('The translation is empty.')
  // An empty list would let every added claim through (checker rules 5 and 7).
  if (trail.claimWords.length === 0 || trail.translatedClaims.length === 0)
    return refuse('The checker’s word lists haven’t loaded yet. Try again in a moment.')
  if (text.length > TRANSLATION_TEXT_LIMIT)
    return refuse(`The translation is too long to publish (at most ${TRANSLATION_TEXT_LIMIT.toLocaleString('en')} characters).`)

  const check = checkTranslation(saved.text, text, saved.factSheet, {
    claimWords: trail.claimWords,
    translatedClaims: trail.translatedClaims,
  })
  if (!check.pass) return refuse(`The translation fails the checker: ${check.issues[0]?.message ?? 'see the problems listed'}`)

  const kept = trail.drafts.slice(-LEDGER_LIMITS.drafts)
  return {
    ok: true,
    alertId: saved.id,
    lang,
    translation: { text, ledgerId },
    ledgerId,
    entry: {
      kind: 'translated',
      alertId: saved.id,
      household: saved.household,
      area: saved.area,
      lang,
      approvalId: saved.ledgerId,
      english: saved.text,
      text,
      source: input.source,
      edited: input.edited,
      cloudModel: clip(trail.cloudModel, LEDGER_LIMITS.cloudModel),
      claimWords: trail.claimWords.slice(0, LEDGER_LIMITS.claimWords),
      translatedClaims: trail.translatedClaims
        .slice(0, LEDGER_LIMITS.translatedClaims)
        .map((c) => ({ words: [...c.words], english: [...c.english] })),
      drafts: kept.map(clipDraft),
      draftsOmitted: trail.drafts.length - kept.length,
    },
  }
}

/** The translations published on one resident copy, as the console shows them. */
export type PublishedTranslations = Partial<Record<LanguageCode, PublishedTranslation & { pending: boolean }>>

/**
 * The translations on a resident copy. A language whose value isn't a
 * translation this app wrote is left out. `pending`: the copy has changes
 * saved on this laptop and not yet uploaded.
 */
export function readPublishedTranslations(data: Record<string, unknown>, pending: boolean): PublishedTranslations {
  const out: PublishedTranslations = {}
  if (data.status !== 'active') return out
  const all = data.translations
  if (typeof all !== 'object' || all === null) return out
  for (const lang of LANGUAGE_CODES) {
    const t = (all as Record<string, unknown>)[lang]
    if (typeof t !== 'object' || t === null) continue
    const { text, ledgerId } = t as Record<string, unknown>
    if (typeof text === 'string' && typeof ledgerId === 'string') out[lang] = { text, ledgerId, pending }
  }
  return out
}
