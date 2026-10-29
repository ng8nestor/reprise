import { CODES, type Code, type Color } from '../../shared/vocabulary.ts'
import type { Book } from '../capture/books.ts'

// Pure pieces of the browse filters; browse.ts does the I/O.

// null means "All" for that filter.
export interface BrowseFilters {
  bookId: string | null
  color: Color | null
  code: Code | null
}

export const NO_FILTERS: BrowseFilters = {
  bookId: null,
  color: null,
  code: null,
}

export function hasActiveFilters(filters: BrowseFilters): boolean {
  return (
    filters.bookId !== null || filters.color !== null || filters.code !== null
  )
}

// One condition on the highlights query, in PostgREST terms. Filters
// combine with AND, so a list of these is the whole WHERE clause.
export type FilterClause =
  | { kind: 'equals'; column: string; value: string }
  | { kind: 'contains'; column: string; values: string[] }

// A highlight has no book column: the book is reached through its page, so
// the column is the embedded `page` from browse.ts's select.
export function buildFilterClauses(filters: BrowseFilters): FilterClause[] {
  const clauses: FilterClause[] = []
  if (filters.bookId !== null) {
    clauses.push({
      kind: 'equals',
      column: 'page.book_id',
      value: filters.bookId,
    })
  }
  if (filters.color !== null) {
    clauses.push({ kind: 'equals', column: 'color', value: filters.color })
  }
  // Array containment (codes @> '{RCT}'), the query the GIN index serves.
  if (filters.code !== null) {
    clauses.push({ kind: 'contains', column: 'codes', values: [filters.code] })
  }
  return clauses
}

// The color filter names the pen color, not what it means: the meaning
// ("Claim", "Evidence") depends on each book's kind.
const COLOR_NAMES: Record<Color, string> = { pink: 'Pink', yellow: 'Yellow' }

export function colorFilterLabel(color: Color | null): string {
  return color === null ? 'All' : COLOR_NAMES[color]
}

export function bookFilterLabel(book: Book): string {
  return book.author ? `${book.title} · ${book.author}` : book.title
}

// <select> values are strings. Anything that isn't a known code (including
// the empty "All" value) means "All".
export function parseCode(value: string): Code | null {
  return CODES.find((code) => code === value) ?? null
}
