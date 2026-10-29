import { describe, expect, it } from 'vitest'
import {
  BROWSE_PAGE_SIZE,
  loadedCountLabel,
  pageRange,
  splitPage,
} from './browsePage.ts'

const rows = (n: number) => Array.from({ length: n }, (_, i) => i)

describe('pageRange', () => {
  it('asks for one row more than a page, starting at the offset', () => {
    expect(pageRange(0)).toEqual({ from: 0, to: BROWSE_PAGE_SIZE })
    expect(pageRange(50)).toEqual({ from: 50, to: 50 + BROWSE_PAGE_SIZE })
  })
})

describe('splitPage', () => {
  it('has no more when fewer than a page came back', () => {
    const page = splitPage(rows(7))
    expect(page.rows).toHaveLength(7)
    expect(page.hasMore).toBe(false)
  })

  it('has no more when exactly a page came back', () => {
    const page = splitPage(rows(BROWSE_PAGE_SIZE))
    expect(page.rows).toHaveLength(BROWSE_PAGE_SIZE)
    expect(page.hasMore).toBe(false)
  })

  it('drops the look-ahead row and has more when it is there', () => {
    const page = splitPage(rows(BROWSE_PAGE_SIZE + 1))
    expect(page.rows).toEqual(rows(BROWSE_PAGE_SIZE))
    expect(page.hasMore).toBe(true)
  })

  it('handles nothing', () => {
    expect(splitPage([])).toEqual({ rows: [], hasMore: false })
  })
})

describe('loadedCountLabel', () => {
  it('pluralizes', () => {
    expect(loadedCountLabel(1)).toBe('1 highlight')
    expect(loadedCountLabel(50)).toBe('50 highlights')
  })
})
