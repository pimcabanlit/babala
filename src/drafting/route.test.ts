import { describe, expect, it } from 'vitest'
import { MAX_AI_CALLS, nextStep, type AttemptOutcome } from './route'

const online = { online: true, onDeviceReady: true }
const offline = { online: false, onDeviceReady: true }
const fail = (route: AttemptOutcome['route'], extra: Partial<AttemptOutcome> = {}): AttemptOutcome => ({ route, passed: false, ...extra })

describe('nextStep', () => {
  it('starts on the device', () => {
    expect(nextStep([], online)).toEqual({ kind: 'draft', route: 'prefer_on_device', retry: false })
    expect(nextStep([], offline)).toEqual({ kind: 'draft', route: 'prefer_on_device', retry: false })
  })

  it('stops as soon as a draft passes', () => {
    expect(nextStep([{ route: 'prefer_on_device', passed: true }], online)).toEqual({ kind: 'done' })
    expect(nextStep([fail('prefer_on_device'), { route: 'prefer_on_device', passed: true }], online)).toEqual({ kind: 'done' })
  })

  it('retries once on the device, then goes to the cloud when online', () => {
    expect(nextStep([fail('prefer_on_device')], online)).toEqual({ kind: 'draft', route: 'prefer_on_device', retry: true })
    expect(nextStep([fail('prefer_on_device'), fail('prefer_on_device')], online)).toEqual({
      kind: 'draft',
      route: 'only_in_cloud',
      retry: true,
    })
  })

  it('hands over to the officer when offline after the retry', () => {
    expect(nextStep([fail('prefer_on_device')], offline)).toEqual({ kind: 'draft', route: 'prefer_on_device', retry: true })
    expect(nextStep([fail('prefer_on_device'), fail('prefer_on_device')], offline).kind).toBe('manual')
  })

  it('goes straight to the cloud after the officer gives up on a slow on-device draft', () => {
    expect(nextStep([fail('prefer_on_device', { abandoned: true })], online)).toEqual({
      kind: 'draft',
      route: 'only_in_cloud',
      retry: true,
    })
  })

  it('never makes more than three AI calls for one alert', () => {
    const three = [fail('prefer_on_device'), fail('prefer_on_device'), fail('only_in_cloud')]
    expect(three).toHaveLength(MAX_AI_CALLS)
    expect(nextStep(three, online).kind).toBe('manual')
    // And never a second cloud call.
    expect(nextStep([fail('prefer_on_device', { abandoned: true }), fail('only_in_cloud')], online).kind).toBe('manual')
  })

  it('asks for a hand-written alert when there is no model and no connection', () => {
    expect(nextStep([], { online: false, onDeviceReady: false }).kind).toBe('manual')
  })
})
