/**
 * Pure helpers for the officer workspace's frame: which view the address
 * opens, how far the officer is through creating an alert, and the short
 * status words in the app bar and the drawer. No React or Firebase here.
 */
import type { DeviceStatus } from '../ai/deviceStatus'

export type View = 'create' | 'saved' | 'ledger'

/** The view an address opens: `#saved` and `#ledger`, and creating an alert for anything else, so the back button works. */
export function viewFromHash(hash: string): View {
  if (hash === '#saved') return 'saved'
  if (hash === '#ledger') return 'ledger'
  return 'create'
}

export type StepState = { state: 'done' | 'current' } | { state: 'locked'; reason: string }

/**
 * The three steps of creating an alert. A step opens once the one before it
 * is done; the drawer says why a locked one can't start yet.
 */
export function stepStates(progress: { bulletinRead: boolean; factsConfirmed: boolean; allApproved: boolean }): [StepState, StepState, StepState] {
  const { bulletinRead, factsConfirmed, allApproved } = progress
  return [
    { state: bulletinRead ? 'done' : 'current' },
    !bulletinRead ? { state: 'locked', reason: 'Read a bulletin first' } : { state: factsConfirmed ? 'done' : 'current' },
    !factsConfirmed ? { state: 'locked', reason: 'Confirm the fact sheet first' } : { state: allApproved ? 'done' : 'current' },
  ]
}

export type Tone = 'ok' | 'busy' | 'warn' | 'off' | 'problem'

export type ModelPill = { tone: Tone; icon: 'computer' | 'cloud' | 'download' | 'wifi_off'; text: string }

/**
 * Which model drafts now, in a few words for the app bar: the on-device
 * model while it can, its download or warm-up, the cloud, or nothing offline.
 */
export function modelPill(m: {
  online: boolean
  device: DeviceStatus
  /** Download progress from 0 to 1 while the officer prepares the model. */
  download: number | undefined
  /** Seconds since the warm-up started, while it runs. */
  warmingSeconds: number | undefined
}): ModelPill {
  if (m.download !== undefined) return { tone: 'busy', icon: 'download', text: `Downloading ${Math.round(m.download * 100)}%` }
  if (m.warmingSeconds !== undefined) return { tone: 'busy', icon: 'computer', text: `Warming up · ${Math.round(m.warmingSeconds)} s` }
  if (m.device === 'available') return { tone: 'ok', icon: 'computer', text: m.online ? 'On-device model ready' : 'Offline · on-device model ready' }
  if (!m.online) return { tone: 'warn', icon: 'wifi_off', text: 'Offline' }
  if (m.device === 'downloadable') return { tone: 'warn', icon: 'download', text: 'On-device model not downloaded' }
  return { tone: 'off', icon: 'cloud', text: 'Cloud only' }
}

export type Summary = { tone: Tone; text: string }

/** The on-device model in a word or two, for the drawer's status card. */
export function deviceSummary(device: DeviceStatus): Summary {
  switch (device) {
    case 'available':
      return { tone: 'ok', text: 'Ready' }
    case 'downloadable':
      return { tone: 'warn', text: 'Not downloaded' }
    case 'downloading':
      return { tone: 'busy', text: 'Downloading' }
    case 'unavailable':
    case 'unsupported':
      return { tone: 'off', text: 'Not on this laptop' }
    case 'unknown':
      return { tone: 'off', text: 'Unknown' }
  }
}

export function cloudSummary(online: boolean): Summary {
  return online ? { tone: 'ok', text: 'Online' } : { tone: 'warn', text: 'Offline' }
}

/** Firebase as a whole: a problem if any setup check failed, working once they all pass. */
export function setupSummary(states: ('pending' | 'ok' | 'error')[]): Summary {
  if (states.includes('error')) return { tone: 'problem', text: 'Problem' }
  if (states.includes('pending')) return { tone: 'busy', text: 'Checking' }
  return { tone: 'ok', text: 'Working' }
}
