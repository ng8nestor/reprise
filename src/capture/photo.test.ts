import { describe, expect, it } from 'vitest'
import { fitLongEdge, MAX_LONG_EDGE, stripDataUrlPrefix } from './photo.ts'

describe('fitLongEdge', () => {
  it('shrinks a portrait photo by its height', () => {
    expect(fitLongEdge({ width: 3024, height: 4032 })).toEqual({
      width: 1176,
      height: MAX_LONG_EDGE,
    })
  })

  it('shrinks a landscape photo by its width', () => {
    expect(fitLongEdge({ width: 4032, height: 3024 })).toEqual({
      width: MAX_LONG_EDGE,
      height: 1176,
    })
  })

  it('leaves a small photo alone', () => {
    expect(fitLongEdge({ width: 800, height: 1200 })).toEqual({
      width: 800,
      height: 1200,
    })
  })

  it('keeps an edge exactly at the limit', () => {
    expect(fitLongEdge({ width: MAX_LONG_EDGE, height: 1000 })).toEqual({
      width: MAX_LONG_EDGE,
      height: 1000,
    })
  })

  it('never rounds a side down to zero', () => {
    expect(fitLongEdge({ width: 10_000, height: 1 })).toEqual({
      width: MAX_LONG_EDGE,
      height: 1,
    })
  })
})

describe('stripDataUrlPrefix', () => {
  it('returns the base64 after the comma', () => {
    expect(stripDataUrlPrefix('data:image/jpeg;base64,/9j/4AAQ')).toBe(
      '/9j/4AAQ',
    )
  })

  it('rejects a string that is not a data URL', () => {
    expect(() => stripDataUrlPrefix('/9j/4AAQ')).toThrow()
  })
})
