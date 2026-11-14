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

export type SyncPill = { tone: SyncLine['tone']; text: string }

/** The short form of the status line, for the pill in the app bar. The line under the header card says the rest. */
export function syncPill(sync: Sync, formatTime: (ms: number) => string): SyncPill {
  if (sync.error || (sync.live && sync.saveError)) return { tone: 'problem', text: 'Problem' }
  if (sync.live) return { tone: 'ok', text: 'Live' }
  if (!sync.online) {
    return { tone: 'offline', text: sync.savedAtMs === undefined ? 'Offline' : `Offline · saved ${formatTime(sync.savedAtMs)}` }
  }
  return { tone: 'offline', text: 'Connecting…' }
}

/**
 * How this phone adds the page to its home screen. Chrome offers its own
 * install prompt; Safari on iPhone and iPad never does, so the page explains
 * Share, then Add to Home Screen. An installed copy needs neither.
 */
export type InstallMode = 'installed' | 'ios' | 'other'

export function installMode(env: { standalone: boolean; userAgent: string; platform: string; maxTouchPoints: number }): InstallMode {
  if (env.standalone) return 'installed'
  // iPadOS asks for desktop sites, so it says "MacIntel"; only the touch screen gives it away.
  const ios = /iPhone|iPad|iPod/.test(env.userAgent) || (env.platform === 'MacIntel' && env.maxTouchPoints > 1)
  return ios ? 'ios' : 'other'
}
