import { afterEach, describe, expect, it, vi } from 'vitest'
import { firstDueOn, localDateString } from './dueDate.ts'

// stubEnv sets the TZ environment variable, and Node switches time zone as
// soon as it changes, so each test can pin the "phone's" time zone.
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('localDateString', () => {
  it('pads month and day', () => {
    expect(localDateString(new Date(2026, 0, 5, 12))).toBe('2026-01-05')
  })
})

describe('firstDueOn', () => {
  it('is the next calendar day', () => {
    expect(firstDueOn(new Date(2026, 9, 27, 9, 30))).toBe('2026-10-28')
  })

  it('uses the local date in the evening, when UTC is already tomorrow', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    // 10:30pm Oct 27 in California = 05:30 Oct 28 UTC.
    const now = new Date('2026-10-28T05:30:00Z')
    expect(firstDueOn(now)).toBe('2026-10-28')
  })

  it('uses the local date in the morning, when UTC is still yesterday', () => {
    vi.stubEnv('TZ', 'Asia/Tokyo')
    // 7am Oct 28 in Tokyo = 22:00 Oct 27 UTC.
    const now = new Date('2026-10-27T22:00:00Z')
    expect(firstDueOn(now)).toBe('2026-10-29')
  })

  it('rolls over the end of a month and a year', () => {
    expect(firstDueOn(new Date(2026, 9, 31, 20))).toBe('2026-11-01')
    expect(firstDueOn(new Date(2026, 11, 31, 23, 59))).toBe('2027-01-01')
  })

  it('handles February in leap and non-leap years', () => {
    expect(firstDueOn(new Date(2028, 1, 28, 12))).toBe('2028-02-29')
    expect(firstDueOn(new Date(2027, 1, 28, 12))).toBe('2027-03-01')
  })

  it('is not thrown off by a daylight-saving change', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    // Clocks go back on Nov 1, 2026 (a 25-hour day) and forward on
    // Mar 14, 2027 (a 23-hour day).
    expect(firstDueOn(new Date(2026, 9, 31, 23, 30))).toBe('2026-11-01')
    expect(firstDueOn(new Date(2026, 10, 1, 23, 30))).toBe('2026-11-02')
    expect(firstDueOn(new Date(2027, 2, 13, 23, 30))).toBe('2027-03-14')
    expect(firstDueOn(new Date(2027, 2, 14, 0, 30))).toBe('2027-03-15')
  })
})
