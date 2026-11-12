import type { Firestore } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { watchLedger, type LedgerView } from '../ledger/store'

/** The latest ledger entries, kept current, with any error reading them. */
export function useLedger(db: Firestore) {
  const [view, setView] = useState<LedgerView>()
  const [error, setError] = useState<string>()
  useEffect(
    () =>
      watchLedger(
        db,
        (next) => {
          setView(next)
          setError(undefined)
        },
        (err) => setError(err.message),
      ),
    [db],
  )
  return { view, error }
}
