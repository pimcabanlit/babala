import type { Firestore } from 'firebase/firestore'
import { useCallback, useEffect, useRef, useState } from 'react'
import { translateOnce, type Source, type TranslationModel } from '../ai'
import type { SavedAlert } from '../alerts/record'
import { checkTranslation } from '../checker'
import { newLedgerId } from '../alerts/store'
import type { LedgerDraft, TranslationSource } from '../ledger/record'
import type { TranslationClaims } from '../firebase/remoteConfig'
import { LANGUAGES, type LanguageCode } from '../translation/languages'
import { readTranslation, translationPrompt } from '../translation/prompt'
import { translationWrites, type PublishedTranslations } from '../translation/record'
import { publishTranslation, watchPublishedTranslations } from '../translation/store'

/** One alert's translation into one language, while the officer works on it. */
export type TranslationDraft = {
  /** The approval it translates: the alert's ledgerId when it started. A new approval starts afresh. */
  forApproval: string
  text: string
  source: TranslationSource
  edited: boolean
  running: boolean
  /** Every cloud call for it since it was last published, oldest first. They go in the ledger entry. */
  attempts: LedgerDraft[]
  /** Saved on the laptop and waiting to upload, or uploading. */
  publishing: boolean
  /** Why it wasn't published, or the last call's error. */
  error: string | undefined
}

export const draftKey = (alertId: string, lang: LanguageCode) => `${alertId}__${lang}`

/** The translations published on each resident copy, kept current, with any error reading them. */
export function usePublishedTranslations(db: Firestore) {
  const [published, setPublished] = useState<Map<string, PublishedTranslations>>()
  const [error, setError] = useState<string>()
  useEffect(
    () =>
      watchPublishedTranslations(
        db,
        (byAlert) => {
          setPublished(byAlert)
          setError(undefined)
        },
        (err) => setError(err.message),
      ),
    [db],
  )
  return { published, error }
}

type Options = {
  db: Firestore
  uid: string
  model: TranslationModel | undefined
  cloudModel: string
  claimWords: string[]
  translationClaims: TranslationClaims | undefined
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))

/**
 * The console's translation work: one cloud call per click for one alert and
 * language, the officer's edits, and publishing. Each language is checked on
 * its own against the saved English alert (checker rule 7), on every change.
 * Nothing here retries a call by itself.
 */
export function useTranslations({ db, uid, model, cloudModel, claimWords, translationClaims }: Options) {
  const [drafts, setDrafts] = useState<Partial<Record<string, TranslationDraft>>>({})
  // Read inside async callbacks, which would otherwise see the state of the render that started them.
  const latest = useRef(drafts)
  latest.current = drafts

  const update = useCallback((key: string, change: (d: TranslationDraft) => TranslationDraft) => {
    setDrafts((all) => {
      const d = all[key]
      return d ? { ...all, [key]: change(d) } : all
    })
  }, [])

  /** The draft for this alert and language, unless it was made for an earlier approval. */
  const draftFor = useCallback(
    (alert: SavedAlert, lang: LanguageCode): TranslationDraft | undefined => {
      const d = drafts[draftKey(alert.id, lang)]
      return d && d.forApproval === alert.ledgerId ? d : undefined
    },
    [drafts],
  )

  /** Changes the draft for this alert and language, starting a fresh one for the alert's current approval. */
  const start = useCallback((alert: SavedAlert, lang: LanguageCode, change: (d: TranslationDraft) => TranslationDraft) => {
    const key = draftKey(alert.id, lang)
    setDrafts((all) => {
      const old = all[key]
      const current: TranslationDraft =
        old && old.forApproval === alert.ledgerId
          ? old
          : {
              forApproval: alert.ledgerId ?? '',
              text: '',
              source: 'none',
              edited: false,
              running: false,
              attempts: [],
              publishing: false,
              error: undefined,
            }
      return { ...all, [key]: change(current) }
    })
  }, [])

  const translate = useCallback(
    async (alert: SavedAlert, lang: LanguageCode) => {
      const language = LANGUAGES.find((l) => l.code === lang)
      const key = draftKey(alert.id, lang)
      const old = latest.current[key]
      if (!model || !language || !alert.factSheet || !translationClaims || (old?.running && old.forApproval === alert.ledgerId)) return
      const sheet = alert.factSheet
      const prompt = translationPrompt(alert.text, sheet, language)
      const startedAtMs = Date.now()
      start(alert, lang, (d) => ({ ...d, running: true, error: undefined }))
      const round = (old && old.forApproval === alert.ledgerId ? old.attempts.length : 0) + 1
      const attempt: LedgerDraft = {
        round,
        route: 'only_in_cloud',
        retry: false,
        area: alert.area,
        source: 'unknown',
        prompt,
        text: '',
        outcome: 'error',
        issues: [],
        error: '',
        startedAtMs,
        firstTextMs: null,
        totalMs: 0,
      }
      try {
        const answer = await translateOnce(model, prompt)
        const text = readTranslation(answer.text)
        const check = checkTranslation(alert.text, text, sheet, { claimWords, translatedClaims: translationClaims[lang] })
        const done: LedgerDraft = {
          ...attempt,
          source: sourceOf(answer.source),
          text,
          outcome: check.pass ? 'passed' : 'failed',
          issues: check.issues.map(({ rule, message }) => ({ rule, message })),
          totalMs: Date.now() - startedAtMs,
        }
        update(key, (d) => ({
          ...d,
          running: false,
          text,
          source: done.source === 'in_cloud' ? 'in_cloud' : 'unknown',
          edited: false,
          attempts: [...d.attempts, done],
        }))
      } catch (err) {
        const failed: LedgerDraft = { ...attempt, error: errorText(err), totalMs: Date.now() - startedAtMs }
        update(key, (d) => ({ ...d, running: false, error: `The cloud didn’t translate it: ${failed.error}`, attempts: [...d.attempts, failed] }))
      }
    },
    [model, claimWords, translationClaims, start, update],
  )

  function edit(alert: SavedAlert, lang: LanguageCode, text: string) {
    start(alert, lang, (d) => ({ ...d, text, edited: true, error: undefined }))
  }

  /** Re-checks and publishes the translation. Returns nothing; problems show on the draft. */
  function publish(alert: SavedAlert, lang: LanguageCode) {
    const d = draftFor(alert, lang)
    if (!d || !translationClaims) return
    const key = draftKey(alert.id, lang)
    const writes = translationWrites(
      {
        saved: alert,
        lang,
        text: d.text,
        source: d.source,
        edited: d.edited,
        trail: { drafts: d.attempts, cloudModel, claimWords, translatedClaims: translationClaims[lang] },
      },
      newLedgerId(db),
    )
    if (!writes.ok) {
      update(key, (x) => ({ ...x, error: writes.reason }))
      return
    }
    update(key, (x) => ({ ...x, publishing: true, error: undefined }))
    publishTranslation(db, uid, writes).then(
      // Published: the resident copy now shows it, and the next translation starts afresh.
      () =>
        setDrafts((all) => {
          const { [key]: done, ...rest } = all
          return done?.publishing && done.forApproval === d.forApproval ? rest : all
        }),
      (err: unknown) => update(key, (x) => ({ ...x, publishing: false, error: `Not published: ${errorText(err)}` })),
    )
  }

  return { draftFor, translate, edit, publish }
}

/** Which model answered, for the ledger. "Only in cloud" never runs on the device. */
function sourceOf(source: Source | undefined): LedgerDraft['source'] {
  return source === 'in_cloud' ? 'in_cloud' : 'unknown'
}
