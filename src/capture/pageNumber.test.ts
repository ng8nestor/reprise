import { describe, expect, it } from 'vitest'
import { parsePageNumber } from './pageNumber.ts'

describe('parsePageNumber', () => {
  it('reads a whole number', () => {
    expect(parsePageNumber('42')).toBe(42)
  })

  it('ignores surrounding spaces and leading zeros', () => {
    expect(parsePageNumber(' 007 ')).toBe(7)
  })

  it.each(['', '   ', '0', '00', '-3', '12.5', '1e3', 'twelve', '12a'])(
    'rejects %j',
    (input) => {
      expect(parsePageNumber(input)).toBeNull()
    },
  )

  it('rejects numbers too large to store exactly', () => {
    expect(parsePageNumber('99999999999999999999')).toBeNull()
  })
})
