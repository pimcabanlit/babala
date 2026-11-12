import { describe, expect, it } from 'vitest'
import { ON_DEVICE_IO, canPrepare, describeDeviceStatus, readDeviceStatus, toDeviceStatus } from './deviceStatus'

describe('readDeviceStatus', () => {
  it('reports unsupported when the browser has no LanguageModel API', async () => {
    expect(await readDeviceStatus({})).toBe('unsupported')
  })

  it('asks Chrome about English text in and out, the on-device job shape', async () => {
    let asked: unknown
    const status = await readDeviceStatus({
      LanguageModel: {
        availability: async (options) => {
          asked = options
          return 'downloadable'
        },
      },
    })
    expect(status).toBe('downloadable')
    expect(asked).toEqual(ON_DEVICE_IO)
  })

  it('reports unknown when Chrome throws', async () => {
    const status = await readDeviceStatus({
      LanguageModel: { availability: async () => Promise.reject(new Error('boom')) },
    })
    expect(status).toBe('unknown')
  })
})

describe('toDeviceStatus', () => {
  it('passes the four Chrome values through and maps anything else to unknown', () => {
    expect(['available', 'downloadable', 'downloading', 'unavailable', 'readily'].map(toDeviceStatus)).toEqual([
      'available',
      'downloadable',
      'downloading',
      'unavailable',
      'unknown',
    ])
  })
})

describe('canPrepare and describeDeviceStatus', () => {
  it('offers the download only when Chrome can still download the model', () => {
    expect(canPrepare('downloadable')).toBe(true)
    expect(canPrepare('downloading')).toBe(true)
    expect(canPrepare('available')).toBe(false)
    expect(canPrepare('unsupported')).toBe(false)
  })

  it('tells the officer the cloud takes over when the device can’t run the model', () => {
    expect(describeDeviceStatus('unsupported')).toMatch(/cloud/)
    expect(describeDeviceStatus('unavailable')).toMatch(/cloud/)
  })
})
