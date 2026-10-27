// When a new highlight is first due: tomorrow, by the phone's calendar.
//
// The database's current_date is the UTC date, which runs ahead of the
// phone in the evening (9pm in California is already tomorrow in UTC), so
// the date is worked out here and sent with the save.

// "YYYY-MM-DD" for the local calendar day of `date`.
export function localDateString(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// The local day after `now`, as "YYYY-MM-DD". Built from year/month/day
// instead of adding 24 hours, so a daylight-saving change (a 23- or 25-hour
// day) can't skip or repeat a date. Noon keeps it clear of midnight, which
// some time zones skip when the clocks change.
export function firstDueOn(now: Date): string {
  const tomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    12,
  )
  return localDateString(tomorrow)
}
