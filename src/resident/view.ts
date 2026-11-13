/** Pure helpers for the resident view's wording, so they can be unit tested. */

/** Where the alerts on screen came from. */
export type Sync = {
  /** The phone says it has a connection. */
  online: boolean
  /** Online, and the pack on screen came from the server just now: new alerts appear as they're approved. */
  live: boolean
  /** When the pack saved on the phone came from the server, if one is saved. */
  savedAtMs: number | undefined
  /** Why the alerts couldn't be read from the server. */
  error: string | undefined
  /** Why the pack couldn't be saved on the phone. */
  saveError: string | undefined
  /** Copies from the server this app couldn't read. */
  unreadable: number
}

export type SyncLine = { tone: 'ok' | 'offline' | 'problem'; text: string }

/** One line under the title saying whether the alerts are live or saved, and from when. */
export function syncLine(sync: Sync, formatTime: (ms: number) => string): SyncLine {
  const savedAt = sync.savedAtMs === undefined ? undefined : formatTime(sync.savedAtMs)
  if (sync.live) {
    if (sync.saveError) return { tone: 'problem', text: `Live, but not saved on this phone for offline use: ${sync.saveError}` }
    return { tone: 'ok', text: 'Live. Saved on this phone, so it opens with no signal too.' }
  }
  const showing = savedAt ? `Showing the alerts saved on this phone at ${savedAt}.` : 'No alerts are saved on this phone yet.'
  if (sync.error) return { tone: 'problem', text: `Couldn’t get new alerts: ${sync.error} ${showing}` }
  if (!sync.online) {
    return { tone: 'offline', text: savedAt ? `Offline. ${showing}` : 'Offline, and no alerts are saved on this phone yet. Connect once to get them.' }
  }
  return { tone: 'offline', text: `Getting the latest alerts… ${showing}` }
}
