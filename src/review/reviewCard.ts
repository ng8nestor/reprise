import {
  BOOK_KINDS,
  CODES,
  COLORS,
  SYMBOLS,
  type BookKind,
  type Code,
  type Color,
  type SymbolName,
} from '../../shared/vocabulary.ts'
import { isBox, type Box } from './scheduler.ts'

// Pure pieces of the review queue; queue.ts does the I/O.

// At most this many highlights per day (SCOPE.md: 5-10).
export const REVIEW_LIMIT = 10

// One highlight as the review screen shows it.
export interface ReviewCard {
  id: string
  text: string
  color: Color
  codes: Code[]
  symbols: SymbolName[]
  box: Box
  bookTitle: string
  kind: BookKind
  pageNumber: number
}

// A highlights row joined through its page to its book, as queue.ts
// selects it.
export interface ReviewRow {
  id: string
  text: string
  color: string
  codes: string[]
  symbols: string[]
  box: number
  page: {
    page_number: number
    book: { title: string; kind: string } | null
  } | null
}

function isOneOf<T extends string>(
  list: readonly T[],
  value: string,
): value is T {
  return list.some((item) => item === value)
}

// The generated types say these columns are any string or number; the
// database's check constraints say they're from the fixed vocabulary.
// Rows that disagree are skipped rather than shown with a made-up label,
// same as books.ts.
export function toReviewCard(row: ReviewRow): ReviewCard | null {
  const book = row.page?.book
  if (!row.page || !book) return null
  const { color, box } = row
  const { kind } = book
  if (!isOneOf(COLORS, color) || !isOneOf(BOOK_KINDS, kind) || !isBox(box)) {
    return null
  }
  return {
    id: row.id,
    text: row.text,
    color,
    codes: row.codes.filter((code) => isOneOf(CODES, code)),
    symbols: row.symbols.filter((symbol) => isOneOf(SYMBOLS, symbol)),
    box,
    bookTitle: book.title,
    kind,
    pageNumber: row.page.page_number,
  }
}

export function toReviewCards(rows: readonly ReviewRow[]): ReviewCard[] {
  return rows.flatMap((row) => {
    const card = toReviewCard(row)
    return card ? [card] : []
  })
}

// "3 of 7": which card is showing, counting from 1.
export function progressLabel(index: number, total: number): string {
  return `${index + 1} of ${total}`
}

// The Home button when highlights are due.
export function reviewButtonLabel(count: number): string {
  return `Review today (${count})`
}
