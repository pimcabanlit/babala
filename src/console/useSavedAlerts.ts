import type { Firestore } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { watchSavedAlerts, type SavedAlerts } from '../alerts/store'

/** The saved alerts, kept current, with any error reading them. */
export function useSavedAlerts(db: Firestore) {
  const [saved, setSaved] = useState<SavedAlerts>()
  const [error, setError] = useState<string>()
  useEffect(
    () =>
      watchSavedAlerts(
        db,
        (alerts) => {
          setSaved(alerts)
          setError(undefined)
        },
        (err) => setError(err.message),
      ),
    [db],
  )
  return { saved, error }
}
