import { describe, expect, it } from 'vitest'
import { syncLine, type Sync } from './view'

const at = (ms: number) => `at-${ms}`
const base: Sync = { online: true, live: true, savedAtMs: 5, error: undefined, saveError: undefined, unreadable: 0 }

describe('syncLine', () => {
  it('says the alerts are live and saved for offline use', () => {
    expect(syncLine(base, at)).toEqual({ tone: 'ok', text: 'Live. Saved on this phone, so it opens with no signal too.' })
  })

  it('warns when the pack couldn’t be saved on the phone', () => {
    expect(syncLine({ ...base, saveError: 'Quota exceeded' }, at).tone).toBe('problem')
  })

  it('says offline and when the saved pack is from', () => {
    expect(syncLine({ ...base, online: false, live: false }, at)).toEqual({
      tone: 'offline',
      text: 'Offline. Showing the alerts saved on this phone at at-5.',
    })
  })

  it('tells a resident offline with nothing saved to connect once', () => {
    expect(syncLine({ ...base, online: false, live: false, savedAtMs: undefined }, at).text).toBe(
      'Offline, and no alerts are saved on this phone yet. Connect once to get them.',
    )
  })

  it('shows a read error with what is still on screen', () => {
    expect(syncLine({ ...base, live: false, error: 'Missing or insufficient permissions.' }, at)).toEqual({
      tone: 'problem',
      text: 'Couldn’t get new alerts: Missing or insufficient permissions. Showing the alerts saved on this phone at at-5.',
    })
  })

  it('says it is still getting the latest alerts while online and waiting for the server', () => {
    expect(syncLine({ ...base, live: false }, at).text).toBe('Getting the latest alerts… Showing the alerts saved on this phone at at-5.')
  })
})
