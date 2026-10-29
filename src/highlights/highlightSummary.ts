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
import { isOneOf } from '../review/reviewCard.ts'

// What a read-only highlight summary shows. A ReviewCard has all of these
// fields, so the capture review screen can pass its own data later.
export interface HighlightSummaryData {
  id: string
  text: string
  color: Color
  kind: BookKind
  bookTitle: string
  pageNumber: number
  codes: Code[]
  symbols: SymbolName[]
}

// A highlights row joined through its page to its book, as browse.ts
// selects it.
export interface HighlightSummaryRow {
  id: string
  text: string
  color: string
  codes: string[]
  symbols: string[]
  page: {
    page_number: number
    book: { title: string; kind: string } | null
  } | null
}

// The generated types say these columns are any string; the database's
// check constraints say they're from the fixed vocabulary. Rows that
// disagree are skipped rather than shown with a made-up label, same as
// toReviewCard.
export function toHighlightSummary(
  row: HighlightSummaryRow,
): HighlightSummaryData | null {
  const book = row.page?.book
  if (!row.page || !book) return null
  const { color } = row
  const { kind } = book
  if (!isOneOf(COLORS, color) || !isOneOf(BOOK_KINDS, kind)) return null
  return {
    id: row.id,
    text: row.text,
    color,
    kind,
    bookTitle: book.title,
    pageNumber: row.page.page_number,
    codes: row.codes.filter((code) => isOneOf(CODES, code)),
    symbols: row.symbols.filter((symbol) => isOneOf(SYMBOLS, symbol)),
  }
}

export function toHighlightSummaries(
  rows: readonly HighlightSummaryRow[],
): HighlightSummaryData[] {
  return rows.flatMap((row) => {
    const summary = toHighlightSummary(row)
    return summary ? [summary] : []
  })
}
