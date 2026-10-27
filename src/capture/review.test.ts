import { describe, expect, it } from 'vitest'
import type { ExtractedHighlight } from './extractClient.ts'
import {
  initReview,
  NEW_HIGHLIGHT_COLOR,
  nextHighlightKey,
  renumber,
  reviewReducer,
  type DraftHighlight,
  type ReviewState,
} from './review.ts'

function extracted(
  position: number,
  overrides: Partial<ExtractedHighlight> = {},
): ExtractedHighlight {
  return {
    position,
    color: 'pink',
    text: `Highlight at ${position}`,
    codes: [],
    symbols: [],
    ...overrides,
  }
}

function threeHighlights(): ReviewState {
  return initReview([extracted(1), extracted(2), extracted(3)])
}

function positions(state: ReviewState): number[] {
  return state.highlights.map((h) => h.position)
}

function keys(state: ReviewState): string[] {
  return state.highlights.map((h) => h.key)
}

function byKey(state: ReviewState, key: string): DraftHighlight {
  const found = state.highlights.find((h) => h.key === key)
  if (!found) throw new Error(`No highlight ${key}`)
  return found
}

describe('initReview', () => {
  it('puts highlights in page order and numbers them 1..n', () => {
    const state = initReview([extracted(5), extracted(2), extracted(9)])
    expect(state.highlights.map((h) => h.text)).toEqual([
      'Highlight at 2',
      'Highlight at 5',
      'Highlight at 9',
    ])
    expect(positions(state)).toEqual([1, 2, 3])
  })

  it('keeps the model order for highlights sharing a position', () => {
    const state = initReview([
      extracted(1, { text: 'first' }),
      extracted(1, { text: 'second' }),
    ])
    expect(state.highlights.map((h) => h.text)).toEqual(['first', 'second'])
    expect(positions(state)).toEqual([1, 2])
  })

  it('gives every highlight a unique key', () => {
    const state = threeHighlights()
    expect(new Set(keys(state)).size).toBe(3)
    expect(nextHighlightKey(state)).not.toBeOneOf(keys(state))
  })

  it('puts codes and symbols in vocabulary order without duplicates', () => {
    const state = initReview([
      extracted(1, {
        codes: ['L', 'H', 'L'],
        symbols: ['connects', 'try'],
      }),
    ])
    expect(state.highlights[0]?.codes).toEqual(['H', 'L'])
    expect(state.highlights[0]?.symbols).toEqual(['try', 'connects'])
  })

  it('starts empty when the model found nothing', () => {
    const state = initReview([])
    expect(state.highlights).toEqual([])
    expect(nextHighlightKey(state)).toBe('h1')
  })
})

describe('reviewReducer', () => {
  it('edits text without trimming while typing', () => {
    const state = reviewReducer(threeHighlights(), {
      type: 'editText',
      key: 'h2',
      text: 'New text ',
    })
    expect(byKey(state, 'h2').text).toBe('New text ')
    expect(byKey(state, 'h1').text).toBe('Highlight at 1')
  })

  it('changes color', () => {
    const state = reviewReducer(threeHighlights(), {
      type: 'setColor',
      key: 'h1',
      color: 'yellow',
    })
    expect(byKey(state, 'h1').color).toBe('yellow')
    expect(byKey(state, 'h2').color).toBe('pink')
  })

  it('toggles a code on in vocabulary order, then off', () => {
    let state = initReview([extracted(1, { codes: ['L'] })])
    state = reviewReducer(state, { type: 'toggleCode', key: 'h1', code: 'H' })
    expect(byKey(state, 'h1').codes).toEqual(['H', 'L'])
    state = reviewReducer(state, { type: 'toggleCode', key: 'h1', code: 'L' })
    expect(byKey(state, 'h1').codes).toEqual(['H'])
  })

  it('toggles a symbol on in vocabulary order, then off', () => {
    let state = initReview([extracted(1, { symbols: ['connects'] })])
    state = reviewReducer(state, {
      type: 'toggleSymbol',
      key: 'h1',
      symbol: 'doubt',
    })
    expect(byKey(state, 'h1').symbols).toEqual(['doubt', 'connects'])
    state = reviewReducer(state, {
      type: 'toggleSymbol',
      key: 'h1',
      symbol: 'connects',
    })
    expect(byKey(state, 'h1').symbols).toEqual(['doubt'])
  })

  it('deletes a highlight and closes the gap in positions', () => {
    const state = reviewReducer(threeHighlights(), {
      type: 'delete',
      key: 'h2',
    })
    expect(keys(state)).toEqual(['h1', 'h3'])
    expect(positions(state)).toEqual([1, 2])
  })

  it('adds an empty highlight at the end with the next key', () => {
    const before = threeHighlights()
    const expectedKey = nextHighlightKey(before)
    const state = reviewReducer(before, { type: 'add' })
    expect(state.highlights).toHaveLength(4)
    expect(state.highlights[3]).toEqual({
      key: expectedKey,
      position: 4,
      color: NEW_HIGHLIGHT_COLOR,
      text: '',
      codes: [],
      symbols: [],
    })
  })

  it('never reuses a key after delete then add', () => {
    let state = threeHighlights()
    state = reviewReducer(state, { type: 'delete', key: 'h3' })
    state = reviewReducer(state, { type: 'add' })
    expect(keys(state)).toEqual(['h1', 'h2', 'h4'])
    expect(positions(state)).toEqual([1, 2, 3])
  })

  it('returns the same state for an unknown key', () => {
    const state = threeHighlights()
    for (const action of [
      { type: 'editText', key: 'nope', text: 'x' },
      { type: 'setColor', key: 'nope', color: 'yellow' },
      { type: 'toggleCode', key: 'nope', code: 'H' },
      { type: 'toggleSymbol', key: 'nope', symbol: 'try' },
      { type: 'delete', key: 'nope' },
    ] as const) {
      expect(reviewReducer(state, action)).toBe(state)
    }
  })

  it('does not mutate the previous state', () => {
    const state = threeHighlights()
    const snapshot = structuredClone(state)
    reviewReducer(state, { type: 'toggleCode', key: 'h1', code: 'A' })
    reviewReducer(state, { type: 'delete', key: 'h1' })
    reviewReducer(state, { type: 'add' })
    expect(state).toEqual(snapshot)
  })
})

describe('renumber', () => {
  it('keeps unchanged highlights as the same objects', () => {
    const state = threeHighlights()
    const result = renumber(state.highlights)
    result.forEach((h, i) => expect(h).toBe(state.highlights[i]))
  })
})
