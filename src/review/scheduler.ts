import { addLocalDays } from '../capture/dueDate.ts'

// Leitner boxes (DECISIONS.md: 1/3/7/14/30 days). Pure: no I/O, no clock.
// The caller passes `now`, so tests can pin the date and time zone.

export const BOXES = [1, 2, 3, 4, 5] as const
export type Box = (typeof BOXES)[number]

export type Grade = 'knowIt' | 'again'

export interface Schedule {
  box: Box
  // "YYYY-MM-DD", the phone's local date.
  dueOn: string
}

// Days to wait before a highlight in each box is due again.
const WAIT_DAYS: Record<Box, number> = { 1: 1, 2: 3, 3: 7, 4: 14, 5: 30 }

// "Know it" moves up one box, and box 5 stays in box 5.
const PROMOTED: Record<Box, Box> = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 5 }

export function isBox(value: number): value is Box {
  return BOXES.some((box) => box === value)
}

// Where a highlight goes after a review: "Know it" moves it up a box and
// waits that box's days; "Again" sends it back to box 1, due tomorrow.
export function nextSchedule(box: Box, grade: Grade, now: Date): Schedule {
  const next = grade === 'knowIt' ? PROMOTED[box] : 1
  return { box: next, dueOn: addLocalDays(now, WAIT_DAYS[next]) }
}
