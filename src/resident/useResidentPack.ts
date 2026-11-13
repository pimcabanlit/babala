import { useEffect, useState } from 'react'
import type { FirebaseServices } from '../firebase'
import { choiceFromJson, packFromJson, packToJson, type Choice, type Pack } from './pack'
import { signInResident, watchResidentAlerts } from './store'
import type { Sync } from './view'

const PACK_KEY = 'babala.pack.v1'
const CHOICE_KEY = 'babala.choice.v1'

/**
 * Storage can be off (private mode, or full). The view still works from the
 * live pack then, so a failure only loses the copy kept for next time.
 */
function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    // No storage: nothing saved from last time.
    return null
  }
}

function writeStorage(key: string, value: string): string | undefined {
  try {
    localStorage.setItem(key, value)
    return undefined
  } catch (err) {
    return err instanceof Error ? err.message : String(err)
  }
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * The alert pack for the resident view. The pack saved on the phone shows
 * first, with no network. Online, the resident is signed in anonymously and
 * the pack is watched live; each pack the server sends replaces the saved one.
 */
export function useResidentPack(fb: FirebaseServices) {
  const [saved, setSaved] = useState<Pack | undefined>(() => packFromJson(readStorage(PACK_KEY)))
  const [live, setLive] = useState<{ pack: Pack; fromServer: boolean; unreadable: number }>()
  const [online, setOnline] = useState(() => navigator.onLine)
  const [error, setError] = useState<string>()
  const [saveError, setSaveError] = useState<string>()

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  // Starts again when the phone comes back online, in case sign-in failed offline.
  useEffect(() => {
    if (!fb.ok) return
    let stop: (() => void) | undefined
    let cancelled = false
    signInResident(fb.auth)
      .then(() => {
        if (cancelled) return
        stop = watchResidentAlerts(
          fb.db,
          (pack, fromServer, unreadable) => {
            setError(undefined)
            setLive({ pack, fromServer, unreadable })
            if (!fromServer) return
            setSaved(pack)
            setSaveError(writeStorage(PACK_KEY, packToJson(pack)))
          },
          (err) => setError(err.message),
        )
      })
      .catch((err: unknown) => {
        // Offline with nobody signed in yet: the saved pack is all there is, and the view says so.
        if (!cancelled && navigator.onLine) setError(`Couldn’t sign in to get the alerts: ${errorText(err)}`)
      })
    return () => {
      cancelled = true
      stop?.()
    }
  }, [fb, online])

  const pack = live?.fromServer ? live.pack : (saved ?? live?.pack)
  const sync: Sync = {
    online,
    live: online && live?.fromServer === true,
    savedAtMs: saved?.savedAtMs,
    error: fb.ok ? error : `This copy of the app is missing its Firebase settings (${fb.missing.join(', ')}).`,
    saveError,
    unreadable: live?.unreadable ?? 0,
  }
  return { pack, sync }
}

/** What the resident picked last time, and a setter that remembers each change on the phone. */
export function useChoice() {
  const [choice, setChoice] = useState<Partial<Choice>>(() => choiceFromJson(readStorage(CHOICE_KEY)))
  const update = (change: Partial<Choice>) => {
    setChoice((old) => {
      const next = { ...old, ...change }
      // Losing the choice only means picking again next time, so a failed save is not shown.
      writeStorage(CHOICE_KEY, JSON.stringify(next))
      return next
    })
  }
  return [choice, update] as const
}
