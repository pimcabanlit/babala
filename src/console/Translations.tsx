import { useMemo } from 'react'
import type { SavedAlert } from '../alerts/record'
import { checkTranslation } from '../checker'
import type { TranslationClaims } from '../firebase/remoteConfig'
import { LANGUAGES, type Language } from '../translation/languages'
import type { PublishedTranslations } from '../translation/record'
import Problems from './Problems'
import type { TranslationDraft } from './useTranslations'
import Button, { LinkButton } from '../ui/Button'
import { StatusChip } from '../ui/Chip'
import Icon from '../ui/Icon'
import Notice from '../ui/Notice'

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
    <div className="mt-4 rounded-md bg-surface-container-low p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h4 className="text-title-sm">Translations</h4>
        <span className="text-body-sm text-on-surface-variant">Cloud only, each checked against the English alert, then published by you.</span>
        {!blocked && (
          <Button
            size="sm"
            variant="tonal"
            onClick={() => LANGUAGES.forEach((l) => void actions.translate(alert, l.code))}
            disabled={!canTranslate || anyRunning}
            className="ml-auto"
          >
            Translate into both
          </Button>
        )}
      </div>
      {blocked && <p className="mt-2 text-body-sm text-on-surface-variant">{blocked}</p>}
      {!blocked && !canTranslate && (
        <p className="mt-2 text-body-sm text-on-surface-variant">Translating needs the cloud: connect to the internet. You can still type one yourself.</p>
      )}
      {!blocked && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
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
    <section aria-label={`${language.label} translation`} className="rounded-md border border-outline-variant bg-surface-container-lowest p-3">
      <header className="flex flex-wrap items-center gap-2">
        <h5 className="text-title-sm">{language.label}</h5>
        {current ? (
          <StatusChip tone="success" icon="check_circle">
            Published
          </StatusChip>
        ) : (
          <StatusChip tone="neutral">Not published</StatusChip>
        )}
        {current?.pending && (
          <StatusChip tone="warning" icon="cloud_upload">
            Not uploaded yet
          </StatusChip>
        )}
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            onClick={() => void actions.translate(alert, language.code)}
            disabled={!canTranslate || draft?.running || draft?.publishing}
          >
            {draft?.attempts.length || current ? 'Translate again' : 'Translate'}
          </Button>
          {!draft && (
            <Button size="sm" variant="text" onClick={() => actions.edit(alert, language.code, current?.text ?? '')}>
              {current ? 'Edit' : 'Write it yourself'}
            </Button>
          )}
        </div>
      </header>

      {current && (
        <p className="mt-2 text-body-md">
          <span lang={language.code} className="whitespace-pre-wrap">
            {current.text}
          </span>{' '}
          <LinkButton onClick={() => onShowLedger(current.ledgerId)} className="text-body-sm">
            See its ledger entry
          </LinkButton>
        </p>
      )}

      {draft?.running && <p className="mt-2 text-body-md text-on-surface-variant">Translating in the cloud…</p>}
      {draft && !draft.running && (
        <div className="mt-3">
          <label className="block text-body-sm font-medium text-on-surface-variant" htmlFor={id}>
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
            className="field mt-1"
          />
          {result && !result.pass && <Problems text={draft.text} issues={result.issues} />}
          {result?.pass && (
            <p className="mt-2 flex items-center gap-1 text-body-md text-success">
              <Icon name="check_circle" className="size-4" />
              Passes the checker against the English alert.
            </p>
          )}
          <Button
            size="sm"
            variant="filled"
            onClick={() => actions.publish(alert, language.code)}
            disabled={!result?.pass || draft.publishing}
            className="mt-3"
          >
            {draft.publishing ? 'Publishing… (uploads when online)' : `Approve and publish ${language.label}`}
          </Button>
        </div>
      )}
      {draft?.error && (
        <Notice tone="error" className="mt-3">
          {draft.error}
        </Notice>
      )}
    </section>
  )
}
