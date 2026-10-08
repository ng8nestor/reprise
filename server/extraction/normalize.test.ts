import { describe, expect, it } from 'vitest'
import { normalizeHyphens } from './normalize.ts'

describe('normalizeHyphens', () => {
  it('joins a word split by a line-break hyphen', () => {
    expect(normalizeHyphens('a cap- able reader')).toBe('a capable reader')
  })

  it('joins in the middle of a sentence', () => {
    expect(normalizeHyphens('in accor- dance with the rules')).toBe(
      'in accordance with the rules',
    )
  })

  it('leaves hyphens with no whitespace after them', () => {
    expect(normalizeHyphens('a well-known result')).toBe('a well-known result')
  })

  it('leaves text with no hyphens unchanged', () => {
    const text = 'Habits form faster than expected.'
    expect(normalizeHyphens(text)).toBe(text)
  })
})
