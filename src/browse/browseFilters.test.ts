import { describe, expect, it } from 'vitest'
import { CODES } from '../../shared/vocabulary.ts'
import {
  NO_FILTERS,
  bookFilterLabel,
  buildFilterClauses,
  colorFilterLabel,
  hasActiveFilters,
  parseCode,
} from './browseFilters.ts'

describe('hasActiveFilters', () => {
  it('is false with no filters', () => {
    expect(hasActiveFilters(NO_FILTERS)).toBe(false)
  })

  it.each([
    { ...NO_FILTERS, bookId: 'b1' },
    { ...NO_FILTERS, color: 'pink' as const },
    { ...NO_FILTERS, code: 'RCT' as const },
  ])('is true when any one filter is set: %o', (filters) => {
    expect(hasActiveFilters(filters)).toBe(true)
  })
})

describe('buildFilterClauses', () => {
  it('builds nothing for "All" everywhere', () => {
    expect(buildFilterClauses(NO_FILTERS)).toEqual([])
  })

  it('filters by book through the embedded page', () => {
    expect(buildFilterClauses({ ...NO_FILTERS, bookId: 'b1' })).toEqual([
      { kind: 'equals', column: 'page.book_id', value: 'b1' },
    ])
  })

  it('filters by color', () => {
    expect(buildFilterClauses({ ...NO_FILTERS, color: 'yellow' })).toEqual([
      { kind: 'equals', column: 'color', value: 'yellow' },
    ])
  })

  it('filters by code with array containment, so the GIN index applies', () => {
    expect(buildFilterClauses({ ...NO_FILTERS, code: 'n=' })).toEqual([
      { kind: 'contains', column: 'codes', values: ['n='] },
    ])
  })

  it('combines every filter that is set', () => {
    expect(
      buildFilterClauses({ bookId: 'b1', color: 'pink', code: 'RCT' }),
    ).toEqual([
      { kind: 'equals', column: 'page.book_id', value: 'b1' },
      { kind: 'equals', column: 'color', value: 'pink' },
      { kind: 'contains', column: 'codes', values: ['RCT'] },
    ])
  })
})

describe('colorFilterLabel', () => {
  it('names each choice in words', () => {
    expect(colorFilterLabel(null)).toBe('All')
    expect(colorFilterLabel('pink')).toBe('Pink')
    expect(colorFilterLabel('yellow')).toBe('Yellow')
  })
})

describe('bookFilterLabel', () => {
  it('adds the author when there is one', () => {
    expect(
      bookFilterLabel({
        id: '1',
        title: 'Thinking, Fast and Slow',
        author: 'Daniel Kahneman',
        kind: 'nonfiction',
      }),
    ).toBe('Thinking, Fast and Slow · Daniel Kahneman')
  })

  it('is just the title without an author', () => {
    expect(
      bookFilterLabel({
        id: '1',
        title: 'Educated',
        author: null,
        kind: 'biography',
      }),
    ).toBe('Educated')
  })
})

describe('parseCode', () => {
  it.each(CODES)('accepts %s', (code) => {
    expect(parseCode(code)).toBe(code)
  })

  it('treats the empty "All" value and unknown codes as All', () => {
    expect(parseCode('')).toBeNull()
    expect(parseCode('rct')).toBeNull()
  })
})
