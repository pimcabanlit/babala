import { describe, expect, it } from 'vitest'
import { formatShortTime } from './format'

describe('formatShortTime', () => {
  const now = new Date(2026, 10, 14, 18, 0)

  it('gives only the time for earlier today', () => {
    expect(formatShortTime(new Date(2026, 10, 14, 14, 5), now)).toBe('2:05 PM')
  })

  it('gives only the day for an earlier day, so it never reads as today', () => {
    expect(formatShortTime(new Date(2026, 10, 13, 14, 5), now)).toBe('Nov 13')
  })
})
