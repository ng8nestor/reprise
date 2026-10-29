// Pure pieces of paging through highlights; browse.ts does the I/O.

export const BROWSE_PAGE_SIZE = 50

// The inclusive row range to ask the database for. It asks for one row more
// than a page, so we know whether "Load more" has anything behind it
// without a second count query.
export function pageRange(offset: number): { from: number; to: number } {
  return { from: offset, to: offset + BROWSE_PAGE_SIZE }
}

export interface HighlightPage<T> {
  rows: T[]
  hasMore: boolean
}

// Trims the extra look-ahead row off what the database returned.
export function splitPage<T>(fetched: readonly T[]): HighlightPage<T> {
  return {
    rows: fetched.slice(0, BROWSE_PAGE_SIZE),
    hasMore: fetched.length > BROWSE_PAGE_SIZE,
  }
}

// "Showing 50 highlights" / "1 highlight". The count is of what is loaded,
// not of all matches (a separate count query isn't worth it).
export function loadedCountLabel(count: number): string {
  return count === 1 ? '1 highlight' : `${count} highlights`
}
