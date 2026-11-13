import { useState } from 'react'
import type { SavedAlert } from '../alerts/record'
import { HOUSEHOLDS } from '../drafting/households'
import { LEDGER_LIMITS } from '../ledger/record'
import { formatTime } from './format'
import { approverLabel } from './ledgerView'
import { inDisplayOrder } from './savedView'

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
}

/**
 * Every saved alert, in every area: what residents will get, and the place to
 * withdraw one. It needs no bulletin, so an officer can withdraw an alert
 * straight after opening the console.
 */
export default function SavedAlerts({ saved, unreadable, error, uid, withdrawErrors, onWithdraw, onShowLedger }: Props) {
  return (
    <div className="space-y-2 text-sm">
      <p className="text-slate-700">
        One alert per household and area. Withdrawing one keeps its text and its record, marks it withdrawn so residents no
        longer get it, and adds the reason to the ledger. Approving a new alert for the same household and area replaces it.
      </p>
      {error && <p className="rounded bg-red-50 p-2 text-red-800">Couldn’t read the saved alerts: {error}</p>}
      {!saved && !error && <p className="text-slate-600">Loading the saved alerts…</p>}
      {saved && saved.length === 0 && <p className="text-slate-600">No alerts saved yet.</p>}
      {unreadable.length > 0 && (
        <p className="rounded bg-amber-100 p-2 text-amber-950">
          These saved documents aren’t alerts this app can read: {unreadable.join(', ')}.
        </p>
      )}
      <ul className="space-y-2">
        {saved &&
          inDisplayOrder(saved).map((alert) => (
            <li key={alert.id}>
              <Row
                alert={alert}
                uid={uid}
                error={withdrawErrors[alert.id]}
                onWithdraw={(reason) => onWithdraw(alert, reason)}
                onShowLedger={onShowLedger}
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
}: {
  alert: SavedAlert
  uid: string
  error: string | undefined
  onWithdraw: (reason: string) => string | undefined
  onShowLedger: (ledgerId: string) => void
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
    <article aria-label={`${household} · ${alert.area}`} className="rounded border border-slate-200 p-2">
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">
          {household} · {alert.area}
        </h3>
        {withdrawn ? (
          <span className="rounded bg-amber-100 px-1.5 text-xs font-semibold text-amber-950">Withdrawn</span>
        ) : (
          <span className="rounded bg-emerald-100 px-1.5 text-xs font-semibold text-emerald-900">Active</span>
        )}
        {alert.pending && <span className="rounded bg-orange-100 px-1.5 text-xs font-semibold text-orange-950">Not uploaded yet</span>}
        {!withdrawn && !form && (
          <button
            type="button"
            onClick={() => setForm({ reason: '' })}
            className="ml-auto rounded border border-red-300 bg-white px-2 py-0.5 text-xs font-medium text-red-800 hover:bg-red-50"
          >
            Withdraw
          </button>
        )}
      </header>
      <p className={`mt-1 whitespace-pre-wrap ${withdrawn ? 'text-slate-500 line-through' : ''}`}>{alert.text}</p>
      <p className="mt-1 text-xs text-slate-600">
        {alert.approvedAt ? `Approved ${formatTime(alert.approvedAt)}` : 'Approval time pending'}
        {withdrawn &&
          ` · withdrawn by ${approverLabel(withdrawn.by, uid)}${withdrawn.at ? ` ${formatTime(withdrawn.at)}` : ''}`}
        {' · '}
        {entryId ? (
          <button type="button" onClick={() => onShowLedger(entryId)} className="font-semibold underline">
            See its ledger entry
          </button>
        ) : (
          'saved before the ledger'
        )}
      </p>
      {error && <p className="mt-2 rounded bg-red-50 p-2 text-red-800">{error}</p>}
      {form && (
        <div className="mt-2 rounded border border-red-200 bg-red-50 p-2">
          <label className="block text-xs font-medium text-red-950" htmlFor={`reason-${alert.id}`}>
            Why are you withdrawing it? The reason goes in the ledger only; residents don’t see it.
          </label>
          <textarea
            id={`reason-${alert.id}`}
            value={form.reason}
            maxLength={LEDGER_LIMITS.reason}
            onChange={(e) => setForm({ reason: e.target.value })}
            rows={2}
            className="mt-1 w-full rounded border border-red-300 bg-white p-2 text-sm"
          />
          {form.problem && <p className="mt-1 text-red-800">{form.problem}</p>}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={confirm}
              className="rounded bg-red-700 px-2 py-1 text-xs font-semibold text-white hover:bg-red-600"
            >
              Withdraw this alert
            </button>
            <button
              type="button"
              onClick={() => setForm(undefined)}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
