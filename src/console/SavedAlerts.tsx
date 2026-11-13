import { useState } from 'react'
import type { SavedAlert } from '../alerts/record'
import { HOUSEHOLDS } from '../drafting/households'
import { LEDGER_LIMITS } from '../ledger/record'
import { formatTime } from './format'
import { approverLabel } from './ledgerView'
import { inDisplayOrder } from './savedView'
import Translations, { type TranslationActions } from './Translations'
import type { TranslationClaims } from '../firebase/remoteConfig'
import type { PublishedTranslations } from '../translation/record'
import Button, { LinkButton } from '../ui/Button'
import { StatusChip } from '../ui/Chip'
import Notice from '../ui/Notice'

type Props = {
  saved: SavedAlert[] | undefined
  /** IDs of documents that aren't alerts this app can read, e.g. after a hand edit in the console. */
  unreadable: string[]
  error: string | undefined
  uid: string
  /** Errors from withdrawals that the server refused, by alert ID. */
  withdrawErrors: Partial<Record<string, string>>
  /** Starts a withdrawal; returns why it can't start, or undefined once it is saved on the laptop. */
  onWithdraw: (alert: SavedAlert, reason: string) => string | undefined
  onShowLedger: (ledgerId: string) => void
  translations: TranslationProps
}

/** What each active alert's translations need. */
export type TranslationProps = {
  /** Translations published on each resident copy, by alert ID; undefined while loading. */
  published: ReadonlyMap<string, PublishedTranslations> | undefined
  /** Why the published translations couldn't be read. */
  error: string | undefined
  actions: TranslationActions
  canTranslate: boolean
  claimWords: string[]
  translationClaims: TranslationClaims | undefined
}

/**
 * Every saved alert, in every area: what residents will get, the place to
 * translate an active one, and the place to withdraw one. It needs no
 * bulletin, so an officer can act on an alert straight after opening the console.
 */
export default function SavedAlerts({ saved, unreadable, error, uid, withdrawErrors, onWithdraw, onShowLedger, translations }: Props) {
  return (
    <div className="space-y-3 text-body-md">
      <p className="text-on-surface-variant">
        One alert per household and area. Withdrawing one keeps its text and its record, marks it withdrawn so residents no
        longer get it or its translations, and adds the reason to the ledger. Approving a new alert for the same household and
        area replaces it, and its translations need publishing again.
      </p>
      {translations.error && <Notice tone="error">Couldn’t read the published translations: {translations.error}</Notice>}
      {error && <Notice tone="error">Couldn’t read the saved alerts: {error}</Notice>}
      {!saved && !error && <p className="text-on-surface-variant">Loading the saved alerts…</p>}
      {saved && saved.length === 0 && <p className="text-on-surface-variant">No alerts saved yet.</p>}
      {unreadable.length > 0 && (
        <Notice tone="warning">These saved documents aren’t alerts this app can read: {unreadable.join(', ')}.</Notice>
      )}
      <ul className="space-y-3">
        {saved &&
          inDisplayOrder(saved).map((alert) => (
            <li key={alert.id}>
              <Row
                alert={alert}
                uid={uid}
                error={withdrawErrors[alert.id]}
                onWithdraw={(reason) => onWithdraw(alert, reason)}
                onShowLedger={onShowLedger}
                translations={translations}
              />
            </li>
          ))}
      </ul>
    </div>
  )
}

function Row({
  alert,
  uid,
  error,
  onWithdraw,
  onShowLedger,
  translations,
}: {
  alert: SavedAlert
  uid: string
  error: string | undefined
  onWithdraw: (reason: string) => string | undefined
  onShowLedger: (ledgerId: string) => void
  translations: TranslationProps
}) {
  const [form, setForm] = useState<{ reason: string; problem?: string }>()
  const household = HOUSEHOLDS.find((h) => h.id === alert.household)?.label ?? alert.household
  const { withdrawn } = alert
  // A withdrawn alert's latest entry is its withdrawal; otherwise its approval, if it has one.
  const entryId = withdrawn?.ledgerId ?? alert.ledgerId

  function confirm() {
    if (!form) return
    const problem = onWithdraw(form.reason)
    setForm(problem ? { ...form, problem } : undefined)
  }

  return (
    <article aria-label={`${household} · ${alert.area}`} className="rounded-md border border-outline-variant p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="text-title-md">
          {household} · {alert.area}
        </h3>
        {withdrawn ? (
          <StatusChip tone="warning" icon="block">
            Withdrawn
          </StatusChip>
        ) : (
          <StatusChip tone="success" icon="check_circle">
            Active
          </StatusChip>
        )}
        {alert.pending && (
          <StatusChip tone="warning" icon="cloud_upload">
            Not uploaded yet
          </StatusChip>
        )}
        {!withdrawn && !form && (
          <Button size="sm" variant="danger-outlined" onClick={() => setForm({ reason: '' })} className="ml-auto">
            Withdraw
          </Button>
        )}
      </header>
      <p className={`mt-2 whitespace-pre-wrap text-body-lg ${withdrawn ? 'text-on-surface-variant line-through' : ''}`}>{alert.text}</p>
      <p className="mt-2 text-body-sm text-on-surface-variant">
        {alert.approvedAt ? `Approved ${formatTime(alert.approvedAt)}` : 'Approval time pending'}
        {withdrawn &&
          ` · withdrawn by ${approverLabel(withdrawn.by, uid)}${withdrawn.at ? ` ${formatTime(withdrawn.at)}` : ''}`}
        {' · '}
        {entryId ? (
          <LinkButton onClick={() => onShowLedger(entryId)}>See its ledger entry</LinkButton>
        ) : (
          'saved before the ledger'
        )}
      </p>
      {error && (
        <Notice tone="error" className="mt-3">
          {error}
        </Notice>
      )}
      {!withdrawn && (
        <Translations
          alert={alert}
          published={translations.published?.get(alert.id)}
          actions={translations.actions}
          canTranslate={translations.canTranslate}
          claimWords={translations.claimWords}
          translationClaims={translations.translationClaims}
          onShowLedger={onShowLedger}
        />
      )}
      {form && (
        <div className="mt-3 rounded-md border border-error bg-error-container p-4 text-on-error-container">
          <label className="block text-body-md font-medium" htmlFor={`reason-${alert.id}`}>
            Why are you withdrawing it? The reason goes in the ledger only; residents don’t see it.
          </label>
          <textarea
            id={`reason-${alert.id}`}
            value={form.reason}
            maxLength={LEDGER_LIMITS.reason}
            onChange={(e) => setForm({ reason: e.target.value })}
            rows={2}
            className="field mt-2"
          />
          {form.problem && <p className="mt-2 font-medium">{form.problem}</p>}
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="danger" onClick={confirm}>
              Withdraw this alert
            </Button>
            <Button size="sm" onClick={() => setForm(undefined)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </article>
  )
}
