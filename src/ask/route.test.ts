/** Which routes answer a question, and this phone's hourly cloud limit. */
import { describe, expect, it } from 'vitest'
import { cloudAllowance, cloudCallsFromJson, looksLocal, planAsk, type AskContext } from './route'

const READY: AskContext = { language: 'en', localQuestion: false, deviceReady: true, configured: true, online: true, cloudLeft: 6 }

describe('planAsk', () => {
  it('tries the device, then the cloud, for an English question with Nano ready and a signal', () => {
    expect(planAsk(READY)).toEqual({ tries: ['on_device', 'cloud'] })
  })

  it('goes straight to the cloud when the alert is read in Filipino, which Nano can’t write', () => {
    expect(planAsk({ ...READY, language: 'fil' })).toEqual({ tries: ['cloud'] })
  })

  it('goes straight to the cloud for a question that looks Cebuano', () => {
    expect(planAsk({ ...READY, localQuestion: true })).toEqual({ tries: ['cloud'] })
  })

  it('uses only the device when offline', () => {
    expect(planAsk({ ...READY, online: false })).toEqual({ tries: ['on_device'] })
  })

  it('uses only the cloud on a phone without Nano', () => {
    expect(planAsk({ ...READY, deviceReady: false })).toEqual({ tries: ['cloud'] })
  })

  it('goes to the text search offline without Nano, and says why', () => {
    expect(planAsk({ ...READY, deviceReady: false, online: false })).toEqual({
      tries: [],
      searchOnly: 'Offline, so the answer comes from the alert saved on this phone, without AI.',
    })
  })

  it('goes to the text search when the phone has no cloud answers left and no Nano', () => {
    expect(planAsk({ ...READY, deviceReady: false, cloudLeft: 0 }).tries).toEqual([])
  })

  it('still uses Nano when the cloud answers have run out', () => {
    expect(planAsk({ ...READY, cloudLeft: 0 }).tries).toEqual(['on_device'])
  })

  it('uses no AI in a copy of the app without Firebase settings', () => {
    expect(planAsk({ ...READY, configured: false }).tries).toEqual([])
  })
})

describe('looksLocal', () => {
  it('marks a Filipino question', () => {
    expect(looksLocal('Saan kami pupunta?')).toBe(true)
  })

  it('marks a Cebuano question', () => {
    expect(looksLocal('Kanus-a motugpa ang bagyo?')).toBe(true)
  })

  it('marks a Taglish question', () => {
    expect(looksLocal('Can we bring pets sa evacuation center?')).toBe(true)
  })

  it('leaves an English question alone', () => {
    expect(looksLocal('When does the storm make landfall?')).toBe(false)
  })
})

describe('cloudAllowance', () => {
  const HOUR = 60 * 60 * 1000
  const now = 10 * HOUR

  it('counts only the calls from the last hour', () => {
    expect(cloudAllowance([now - 2 * HOUR, now - HOUR, now - 1000], now, 6)).toEqual({ left: 5 })
  })

  it('says when the next answer frees up once none are left', () => {
    const calls = [now - 50 * 60 * 1000, now - 40 * 60 * 1000, now - 1000]
    expect(cloudAllowance(calls, now, 3)).toEqual({ left: 0, nextAtMs: now - 50 * 60 * 1000 + HOUR })
  })

  it('turns cloud answers off at 0', () => {
    expect(cloudAllowance([], now, 0)).toEqual({ left: 0 })
  })

  it('ignores a call time in the future, as from a phone clock moved back', () => {
    expect(cloudAllowance([now + HOUR], now, 6)).toEqual({ left: 6 })
  })
})

describe('cloudCallsFromJson', () => {
  it('reads a saved list of times', () => {
    expect(cloudCallsFromJson('[1, 2]')).toEqual([1, 2])
  })

  it('treats a broken or foreign save as no calls', () => {
    for (const bad of [null, '', '{', '{"a": 1}', '"x"']) expect(cloudCallsFromJson(bad), String(bad)).toEqual([])
  })

  it('drops entries that aren’t times', () => {
    expect(cloudCallsFromJson('[1, "2", null, 3]')).toEqual([1, 3])
  })
})
