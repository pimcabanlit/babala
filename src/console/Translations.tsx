import { useMemo } from 'react'
import type { SavedAlert } from '../alerts/record'
import { checkTranslation } from '../checker'
import type { TranslationClaims } from '../firebase/remoteConfig'
import { LANGUAGES, type Language } from '../translation/languages'
import type { PublishedTranslations } from '../translation/record'
import Problems from './Problems'
import type { TranslationDraft } from './useTranslations'

export type TranslationActions = {
  draftFor: (alert: SavedAlert, lang: Language['code']) => TranslationDraft | undefined
  translate: (alert: SavedAlert, lang: Language['code']) => Promise<void>
  edit: (alert: SavedAlert, lang: Language['code'], text: string) => void
  publish: (alert: SavedAlert, lang: Language['code']) => void
}

type Props = {
  alert: SavedAlert
  /** What residents get now in each language; undefined while loading. */
  published: PublishedTranslations | undefined
  actions: TranslationActions
  /** The cloud model is ready and the laptop is online. */
  canTranslate: boolean
  claimWords: string[]
  translationClaims: TranslationClaims | undefined
  onShowLedger: (ledgerId: string) => void
}

/**
 * An active alert's translations: what residents get in each language, and the
 * place to translate, check, edit and publish one. Each language is checked on
 * its own against the English alert above it.
 */
export default function Translations(props: Props) {
  const { alert, actions, canTranslate } = props
  const blocked = !alert.ledgerId
    ? 'Saved before the ledger: approve it again to translate it.'
    : alert.pending
      ? 'Translate it once it has uploaded.'
      : !alert.factSheet
        ? 'Its fact sheet can’t be read, so a translation can’t be checked.'
        : undefined
  const anyRunning = LANGUAGES.some((l) => actions.draftFor(alert, l.code)?.running)

  return (
    <div className="mt-2 rounded border border-sky-200 bg-sky-50/50 p-2">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-sky-900">Translations</h4>
        <span className="text-xs text-slate-600">Cloud only, each checked against the English alert, then published by you.</span>
        {!blocked && (
          <button
            type="button"
            onClick={() => LANGUAGES.forEach((l) => void actions.translate(alert, l.code))}
            disabled={!canTranslate || anyRunning}
            className="ml-auto rounded border border-sky-300 bg-white px-2 py-0.5 text-xs font-medium hover:bg-sky-100 disabled:opacity-50"
          >
            Translate into both
          </button>
        )}
      </div>
      {blocked && <p className="mt-1 text-xs text-slate-600">{blocked}</p>}
      {!blocked && !canTranslate && (
        <p className="mt-1 text-xs text-slate-600">Translating needs the cloud: connect to the internet. You can still type one yourself.</p>
      )}
      {!blocked && (
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {LANGUAGES.map((language) => (
            <LanguageBox key={language.code} {...props} language={language} />
          ))}
        </div>
      )}
    </div>
  )
}

function LanguageBox({
  alert,
  published,
  actions,
  canTranslate,
  claimWords,
  translationClaims,
  onShowLedger,
  language,
}: Props & { language: Language }) {
  const draft = actions.draftFor(alert, language.code)
  const current = published?.[language.code]
  const result = useMemo(
    () =>
      draft && draft.text.trim() && alert.factSheet && translationClaims
        ? checkTranslation(alert.text, draft.text, alert.factSheet, {
            claimWords,
            translatedClaims: translationClaims[language.code],
          })
        : undefined,
    [draft, alert.text, alert.factSheet, claimWords, translationClaims, language.code],
  )
  const id = `translation-${alert.id}-${language.code}`

  return (
    <section aria-label={`${language.label} translation`} className="rounded border border-slate-200 bg-white p-2">
      <header className="flex flex-wrap items-center gap-2">
        <h5 className="font-medium">{language.label}</h5>
        {current ? (
          <span className="rounded bg-emerald-100 px-1.5 text-xs font-semibold text-emerald-900">Published</span>
        ) : (
          <span className="rounded bg-slate-200 px-1.5 text-xs font-semibold text-slate-700">Not published</span>
        )}
        {current?.pending && <span className="rounded bg-orange-100 px-1.5 text-xs font-semibold text-orange-950">Not uploaded yet</span>}
        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => void actions.translate(alert, language.code)}
            disabled={!canTranslate || draft?.running || draft?.publishing}
            className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium hover:bg-slate-100 disabled:opacity-50"
          >
            {draft?.attempts.length || current ? 'Translate again' : 'Translate'}
          </button>
          {!draft && (
            <button
              type="button"
              onClick={() => actions.edit(alert, language.code, current?.text ?? '')}
              className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium hover:bg-slate-100"
            >
              {current ? 'Edit' : 'Write it yourself'}
            </button>
          )}
        </div>
      </header>

      {current && (
        <p className="mt-1 text-sm">
          <span lang={language.code} className="whitespace-pre-wrap">
            {current.text}
          </span>{' '}
          <button type="button" onClick={() => onShowLedger(current.ledgerId)} className="text-xs font-semibold underline">
            See its ledger entry
          </button>
        </p>
      )}

      {draft?.running && <p className="mt-1 text-sm text-slate-600">Translating in the cloud…</p>}
      {draft && !draft.running && (
        <div className="mt-2">
          <label className="block text-xs font-medium text-slate-700" htmlFor={id}>
            {draft.source === 'none' ? 'Typed by you' : draft.edited ? 'The cloud’s translation, edited by you' : 'The cloud’s translation'}
            {' · checked against the English on every change'}
          </label>
          <textarea
            id={id}
            lang={language.code}
            value={draft.text}
            onChange={(e) => actions.edit(alert, language.code, e.target.value)}
            readOnly={draft.publishing}
            rows={4}
            className="mt-1 w-full rounded border border-slate-300 p-2 text-sm"
          />
          {result && !result.pass && <Problems text={draft.text} issues={result.issues} />}
          {result?.pass && <p className="mt-1 text-sm text-emerald-800">Passes the checker against the English alert.</p>}
          <button
            type="button"
            onClick={() => actions.publish(alert, language.code)}
            disabled={!result?.pass || draft.publishing}
            className="mt-2 rounded bg-emerald-700 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-600 disabled:bg-slate-300"
          >
            {draft.publishing ? 'Publishing… (uploads when online)' : `Approve and publish ${language.label}`}
          </button>
        </div>
      )}
      {draft?.error && <p className="mt-2 rounded bg-red-50 p-2 text-sm text-red-800">{draft.error}</p>}
    </section>
  )
}
