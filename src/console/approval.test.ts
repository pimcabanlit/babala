import { describe, expect, it } from 'vitest'
import { writtenBy } from './approval'
import type { Attempt, Draft } from './useDrafts'

const attempt = (a: Partial<Attempt>): Attempt => ({
  id: 1,
  route: 'prefer_on_device',
  retry: false,
  prompt: 'prompt',
  startedAt: 0,
  endedMs: 15000,
  text: 'Alert text.',
  source: 'on_device',
  ...a,
})
const draft = (attempts: Attempt[]): Draft => ({ text: 'Alert text.', attempts, running: false, approved: false })

describe('writtenBy', () => {
  it('names the laptop when Nano wrote the last draft', () => {
    expect(writtenBy(draft([attempt({})]))).toBe('on_device')
  })

  it('names the cloud when the retry in the cloud wrote the last draft', () => {
    expect(writtenBy(draft([attempt({}), attempt({ id: 2, route: 'only_in_cloud', source: 'in_cloud' })]))).toBe('in_cloud')
  })

  it('skips an abandoned cloud attempt and names the laptop draft before it', () => {
    expect(writtenBy(draft([attempt({}), attempt({ id: 2, source: 'in_cloud', abandoned: true, text: '' })]))).toBe('on_device')
  })

  it('skips an attempt that ended in an error', () => {
    expect(writtenBy(draft([attempt({ source: 'in_cloud' }), attempt({ id: 2, error: 'quota', text: '' })]))).toBe('in_cloud')
  })

  it('says none when the officer typed the alert with no model attempt', () => {
    expect(writtenBy(draft([]))).toBe('none')
  })

  it('says unknown when the SDK did not report the source', () => {
    expect(writtenBy(draft([attempt({ source: undefined })]))).toBe('unknown')
  })
})
