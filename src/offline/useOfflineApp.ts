import { useEffect, useState } from 'react'
import { startOfflineApp, type OfflineApp } from './register'

/** Whether this page is saved for opening with no signal, as the service worker reports it. */
export function useOfflineApp(): OfflineApp {
  const [app, setApp] = useState<OfflineApp>({ state: 'starting' })
  useEffect(() => {
    let current = true
    void startOfflineApp().then((next) => {
      if (current) setApp(next)
    })
    return () => {
      current = false
    }
  }, [])
  return app
}
