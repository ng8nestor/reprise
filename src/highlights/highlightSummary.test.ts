import { describe, expect, it } from 'vitest'
import {
  toHighlightSummaries,
  toHighlightSummary,
  type HighlightSummaryRow,
} from './highlightSummary.ts'

function row(
  overrides: Partial<HighlightSummaryRow> = {},
): HighlightSummaryRow {
  return {
    id: 'h1',
    text: 'Sleep consolidates memory.',
    color: 'pink',
    codes: ['RCT'],
    symbols: ['doubt'],
    page: {
      page_number: 42,
      book: { title: 'Why We Sleep', kind: 'nonfiction' },
    },
    ...overrides,
  }
}

describe('toHighlightSummary', () => {
  it('flattens the page and book into one summary', () => {
    expect(toHighlightSummary(row())).toEqual({
      id: 'h1',
      text: 'Sleep consolidates memory.',
      color: 'pink',
      kind: 'nonfiction',
      bookTitle: 'Why We Sleep',
      pageNumber: 42,
      codes: ['RCT'],
      symbols: ['doubt'],
    })
  })

  it('drops codes and symbols outside the vocabulary', () => {
    const summary = toHighlightSummary(
      row({ codes: ['RCT', 'zzz'], symbols: ['try', 'wink'] }),
    )
    expect(summary?.codes).toEqual(['RCT'])
    expect(summary?.symbols).toEqual(['try'])
  })

  it.each([
    ['an unknown color', row({ color: 'green' })],
    [
      'an unknown book kind',
      row({ page: { page_number: 1, book: { title: 'B', kind: 'poetry' } } }),
    ],
    ['a missing page', row({ page: null })],
    ['a missing book', row({ page: { page_number: 1, book: null } })],
  ])('skips a row with %s', (_name, bad) => {
    expect(toHighlightSummary(bad)).toBeNull()
  })
})

describe('toHighlightSummaries', () => {
  it('keeps the order and leaves out the rows it skips', () => {
    const result = toHighlightSummaries([
      row({ id: 'a' }),
      row({ id: 'b', color: 'green' }),
      row({ id: 'c' }),
    ])
    expect(result.map((s) => s.id)).toEqual(['a', 'c'])
  })
})
