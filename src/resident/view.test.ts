import { describe, expect, it } from 'vitest'
import { installMode, syncLine, syncPill, type Sync } from './view'

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

describe('syncPill', () => {
  it('says Live while the alerts come from the server', () => {
    expect(syncPill(base, at)).toEqual({ tone: 'ok', text: 'Live' })
  })

  it('says Problem when the live alerts couldn’t be saved on the phone', () => {
    expect(syncPill({ ...base, saveError: 'Quota exceeded' }, at)).toEqual({ tone: 'problem', text: 'Problem' })
  })

  it('says Problem when the alerts couldn’t be read', () => {
    expect(syncPill({ ...base, live: false, error: 'Missing or insufficient permissions.' }, at).text).toBe('Problem')
  })

  it('says offline and when the saved alerts are from', () => {
    expect(syncPill({ ...base, online: false, live: false }, at)).toEqual({ tone: 'offline', text: 'Offline · saved at-5' })
  })

  it('says only Offline when nothing is saved on the phone', () => {
    expect(syncPill({ ...base, online: false, live: false, savedAtMs: undefined }, at).text).toBe('Offline')
  })

  it('says Connecting while online and waiting for the server', () => {
    expect(syncPill({ ...base, live: false }, at).text).toBe('Connecting…')
  })
})

describe('installMode', () => {
  const phone = { standalone: false, userAgent: '', platform: '', maxTouchPoints: 0 }

  it('needs no install steps in the installed app', () => {
    expect(installMode({ ...phone, standalone: true, userAgent: 'iPhone' })).toBe('installed')
  })

  it('explains Add to Home Screen on an iPhone', () => {
    expect(installMode({ ...phone, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)' })).toBe('ios')
  })

  it('treats an iPad asking for the desktop site as iOS', () => {
    expect(installMode({ ...phone, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 })).toBe('ios')
  })

  it('leaves a Mac without a touch screen to the browser', () => {
    expect(installMode({ ...phone, platform: 'MacIntel' })).toBe('other')
  })

  it('leaves Android to Chrome’s own install prompt', () => {
    expect(installMode({ ...phone, userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 9)', maxTouchPoints: 5 })).toBe('other')
  })
})
