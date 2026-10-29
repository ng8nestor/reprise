import { describe, expect, it } from 'vitest'
import {
  progressLabel,
  reviewButtonLabel,
  toReviewCard,
  toReviewCards,
  type ReviewRow,
} from './reviewCard.ts'

function row(overrides: Partial<ReviewRow> = {}): ReviewRow {
  return {
    id: 'h1',
    text: 'Sleep is the single most effective thing we can do.',
    color: 'pink',
    codes: ['H', 'RCT'],
    symbols: ['doubt'],
    box: 2,
    page: {
      page_number: 108,
      book: { title: 'Why We Sleep', kind: 'nonfiction' },
    },
    ...overrides,
  }
}

describe('toReviewCard', () => {
  it('flattens the page and book into the card', () => {
    expect(toReviewCard(row())).toEqual({
      id: 'h1',
      text: 'Sleep is the single most effective thing we can do.',
      color: 'pink',
      codes: ['H', 'RCT'],
      symbols: ['doubt'],
      box: 2,
      bookTitle: 'Why We Sleep',
      kind: 'nonfiction',
      pageNumber: 108,
    })
  })

  it('skips a row whose color, kind or box is outside the vocabulary', () => {
    expect(toReviewCard(row({ color: 'green' }))).toBeNull()
    expect(toReviewCard(row({ box: 0 }))).toBeNull()
    expect(toReviewCard(row({ box: 6 }))).toBeNull()
    expect(
      toReviewCard(
        row({ page: { page_number: 1, book: { title: 'X', kind: 'poetry' } } }),
      ),
    ).toBeNull()
  })

  it('skips a row with no page or book', () => {
    expect(toReviewCard(row({ page: null }))).toBeNull()
    expect(toReviewCard(row({ page: { page_number: 1, book: null } }))).toBe(
      null,
    )
  })

  it('drops codes and symbols outside the vocabulary', () => {
    const card = toReviewCard(
      row({ codes: ['H', 'XYZ'], symbols: ['try', 'star'] }),
    )
    expect(card?.codes).toEqual(['H'])
    expect(card?.symbols).toEqual(['try'])
  })
})

describe('toReviewCards', () => {
  it('keeps the order and leaves out bad rows', () => {
    const cards = toReviewCards([
      row({ id: 'a' }),
      row({ id: 'b', color: 'blue' }),
      row({ id: 'c' }),
    ])
    expect(cards.map((card) => card.id)).toEqual(['a', 'c'])
  })
})

describe('labels', () => {
  it('counts progress from 1', () => {
    expect(progressLabel(0, 7)).toBe('1 of 7')
    expect(progressLabel(2, 7)).toBe('3 of 7')
  })

  it('shows the due count on the Home button', () => {
    expect(reviewButtonLabel(4)).toBe('Review today (4)')
  })
})
