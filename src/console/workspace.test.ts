import { describe, expect, it } from 'vitest'
import { cloudSummary, deviceSummary, lastOpenStep, modelPill, setupSummary, stepStates, viewFromHash } from './workspace'

describe('viewFromHash', () => {
  it('opens creating an alert with no hash', () => {
    expect(viewFromHash('')).toBe('create')
  })

  it('opens the saved alerts at #saved', () => {
    expect(viewFromHash('#saved')).toBe('saved')
  })

  it('opens the ledger at #ledger', () => {
    expect(viewFromHash('#ledger')).toBe('ledger')
  })

  it('opens creating an alert for a hash it doesn’t know', () => {
    expect(viewFromHash('#settings')).toBe('create')
  })
})

describe('stepStates', () => {
  it('starts at the bulletin with the other two steps locked', () => {
    expect(stepStates({ bulletinRead: false, factsConfirmed: false, allApproved: false })).toEqual([
      { state: 'current' },
      { state: 'locked', reason: 'Read a bulletin first' },
      { state: 'locked', reason: 'Confirm the fact sheet first' },
    ])
  })

  it('moves to the fact sheet once the bulletin is read', () => {
    expect(stepStates({ bulletinRead: true, factsConfirmed: false, allApproved: false }).map((s) => s.state)).toEqual([
      'done',
      'current',
      'locked',
    ])
  })

  it('opens drafting once the facts are confirmed', () => {
    expect(stepStates({ bulletinRead: true, factsConfirmed: true, allApproved: false }).map((s) => s.state)).toEqual([
      'done',
      'done',
      'current',
    ])
  })

  it('marks drafting done when all four households are approved', () => {
    expect(stepStates({ bulletinRead: true, factsConfirmed: true, allApproved: true })[2]).toEqual({ state: 'done' })
  })
})

describe('lastOpenStep', () => {
  it('is the first step before a bulletin is read', () => {
    expect(lastOpenStep(stepStates({ bulletinRead: false, factsConfirmed: false, allApproved: false }))).toBe(0)
  })

  it('is the fact sheet once a bulletin is read but its facts are not confirmed', () => {
    expect(lastOpenStep(stepStates({ bulletinRead: true, factsConfirmed: false, allApproved: false }))).toBe(1)
  })

  it('is drafting once the facts are confirmed', () => {
    expect(lastOpenStep(stepStates({ bulletinRead: true, factsConfirmed: true, allApproved: false }))).toBe(2)
  })
})

describe('modelPill', () => {
  const base = { online: true, device: 'available' as const, download: undefined, warmingSeconds: undefined }

  it('says the on-device model is ready', () => {
    expect(modelPill(base)).toEqual({ tone: 'ok', icon: 'computer', text: 'On-device model ready' })
  })

  it('shows the download in whole percent', () => {
    expect(modelPill({ ...base, device: 'downloading', download: 0.416 }).text).toBe('Downloading 42%')
  })

  it('shows the warm-up time in whole seconds', () => {
    expect(modelPill({ ...base, warmingSeconds: 8.4 }).text).toBe('Warming up · 8 s')
  })

  it('says the on-device model still drafts offline', () => {
    expect(modelPill({ ...base, online: false }).text).toBe('Offline · on-device model ready')
  })

  it('says Offline when nothing can draft', () => {
    expect(modelPill({ ...base, online: false, device: 'unsupported' })).toEqual({ tone: 'warn', icon: 'wifi_off', text: 'Offline' })
  })

  it('points to the download when the model isn’t on the laptop yet', () => {
    expect(modelPill({ ...base, device: 'downloadable' }).text).toBe('On-device model not downloaded')
  })

  it('says Cloud only on a laptop that can’t run the model', () => {
    expect(modelPill({ ...base, device: 'unavailable' }).text).toBe('Cloud only')
  })
})

describe('deviceSummary', () => {
  it('says Ready when the model is on the laptop', () => {
    expect(deviceSummary('available')).toEqual({ tone: 'ok', text: 'Ready' })
  })

  it('says the model is not on a laptop that can’t run it', () => {
    expect(deviceSummary('unsupported').text).toBe('Not on this laptop')
  })
})

describe('cloudSummary', () => {
  it('warns when the laptop is offline', () => {
    expect(cloudSummary(false)).toEqual({ tone: 'warn', text: 'Offline' })
  })
})

describe('setupSummary', () => {
  it('reports a problem when any check failed, even while others still run', () => {
    expect(setupSummary(['ok', 'pending', 'error']).tone).toBe('problem')
  })

  it('says Checking while a check still runs', () => {
    expect(setupSummary(['ok', 'pending']).text).toBe('Checking')
  })

  it('says Working when every check passed', () => {
    expect(setupSummary(['ok', 'ok', 'ok'])).toEqual({ tone: 'ok', text: 'Working' })
  })
})
