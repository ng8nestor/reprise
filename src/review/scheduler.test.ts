import { afterEach, describe, expect, it, vi } from 'vitest'
import { BOXES, isBox, nextSchedule } from './scheduler.ts'

// stubEnv sets TZ, and Node switches time zone as soon as it changes, so
// each test can pin the "phone's" time zone.
afterEach(() => {
  vi.unstubAllEnvs()
})

// Wed Oct 28, 2026, mid-morning local time.
const NOW = new Date(2026, 9, 28, 10, 15)

describe('nextSchedule: Know it', () => {
  it.each([
    [1, 2, '2026-10-31'], // box 2 waits 3 days
    [2, 3, '2026-11-04'], // box 3 waits 7 days
    [3, 4, '2026-11-11'], // box 4 waits 14 days
    [4, 5, '2026-11-27'], // box 5 waits 30 days
    [5, 5, '2026-11-27'], // box 5 is the top: stays, waits 30 days
  ] as const)('box %i moves to box %i, due %s', (box, nextBox, dueOn) => {
    expect(nextSchedule(box, 'knowIt', NOW)).toEqual({ box: nextBox, dueOn })
  })
})

describe('nextSchedule: Again', () => {
  it.each(BOXES)('box %i goes back to box 1, due tomorrow', (box) => {
    expect(nextSchedule(box, 'again', NOW)).toEqual({
      box: 1,
      dueOn: '2026-10-29',
    })
  })
})

describe('nextSchedule: calendar rollover', () => {
  it('rolls over the end of a month', () => {
    const oct31 = new Date(2026, 9, 31, 9)
    expect(nextSchedule(3, 'again', oct31).dueOn).toBe('2026-11-01')
    expect(nextSchedule(1, 'knowIt', oct31).dueOn).toBe('2026-11-03')
    expect(nextSchedule(2, 'knowIt', oct31).dueOn).toBe('2026-11-07')
    // 30-day month: Nov 20 + 14 = Dec 4.
    expect(nextSchedule(3, 'knowIt', new Date(2026, 10, 20, 9)).dueOn).toBe(
      '2026-12-04',
    )
  })

  it('rolls over the end of a year', () => {
    const dec31 = new Date(2026, 11, 31, 23, 59)
    expect(nextSchedule(2, 'again', dec31).dueOn).toBe('2027-01-01')
    expect(nextSchedule(1, 'knowIt', dec31).dueOn).toBe('2027-01-03')
    expect(nextSchedule(2, 'knowIt', dec31).dueOn).toBe('2027-01-07')
    expect(nextSchedule(3, 'knowIt', dec31).dueOn).toBe('2027-01-14')
    expect(nextSchedule(4, 'knowIt', dec31).dueOn).toBe('2027-01-30')
    expect(nextSchedule(5, 'knowIt', new Date(2026, 11, 10, 9)).dueOn).toBe(
      '2027-01-09',
    )
  })

  it('counts February in leap and non-leap years', () => {
    // Feb 20 + 14 days: Mar 5 in a leap year, Mar 6 otherwise.
    expect(nextSchedule(3, 'knowIt', new Date(2028, 1, 20, 9)).dueOn).toBe(
      '2028-03-05',
    )
    expect(nextSchedule(3, 'knowIt', new Date(2027, 1, 20, 9)).dueOn).toBe(
      '2027-03-06',
    )
    expect(nextSchedule(1, 'again', new Date(2028, 1, 28, 9)).dueOn).toBe(
      '2028-02-29',
    )
  })
})

describe('nextSchedule: local date', () => {
  it('counts from the local date in the evening, when UTC is tomorrow', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    // 10:30pm Oct 28 in California = 05:30 Oct 29 UTC.
    const now = new Date('2026-10-29T05:30:00Z')
    expect(nextSchedule(1, 'again', now).dueOn).toBe('2026-10-29')
    expect(nextSchedule(1, 'knowIt', now).dueOn).toBe('2026-10-31')
  })

  it('counts from the local date in the morning, when UTC is yesterday', () => {
    vi.stubEnv('TZ', 'Asia/Tokyo')
    // 7am Oct 29 in Tokyo = 22:00 Oct 28 UTC.
    const now = new Date('2026-10-28T22:00:00Z')
    expect(nextSchedule(1, 'again', now).dueOn).toBe('2026-10-30')
  })

  it('is not thrown off by a daylight-saving change', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    // Clocks go back Nov 1, 2026 and forward Mar 14, 2027.
    const lateOct31 = new Date(2026, 9, 31, 23, 30)
    expect(nextSchedule(1, 'knowIt', lateOct31).dueOn).toBe('2026-11-03')
    expect(nextSchedule(4, 'knowIt', lateOct31).dueOn).toBe('2026-11-30')
    const lateMar13 = new Date(2027, 2, 13, 23, 30)
    expect(nextSchedule(2, 'again', lateMar13).dueOn).toBe('2027-03-14')
    expect(nextSchedule(2, 'knowIt', lateMar13).dueOn).toBe('2027-03-20')
  })
})

describe('isBox', () => {
  it('accepts 1 to 5 only', () => {
    expect(BOXES.every(isBox)).toBe(true)
    expect([0, 6, -1, 2.5].some(isBox)).toBe(false)
  })
})
