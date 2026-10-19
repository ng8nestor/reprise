import {
  CODES,
  SYMBOLS,
  type Code,
  type Color,
  type SymbolName,
} from '../../shared/vocabulary.ts'
import type { ExtractedHighlight } from './extractClient.ts'

// The highlights of one page while I review them, before saving.

export interface DraftHighlight {
  // Stable React key; positions change when highlights are added or deleted.
  key: string
  // 1-based page order, always 1..n with no gaps.
  position: number
  color: Color
  text: string
  // Kept in vocabulary order, without duplicates.
  codes: Code[]
  symbols: SymbolName[]
}

export interface ReviewState {
  highlights: DraftHighlight[]
  // Counter for keys, so the reducer stays pure (no random ids).
  nextKey: number
}

export type ReviewAction =
  | { type: 'editText'; key: string; text: string }
  | { type: 'setColor'; key: string; color: Color }
  | { type: 'toggleCode'; key: string; code: Code }
  | { type: 'toggleSymbol'; key: string; symbol: SymbolName }
  | { type: 'delete'; key: string }
  | { type: 'add' }

// A manual highlight starts yellow; one tap makes it pink.
export const NEW_HIGHLIGHT_COLOR: Color = 'yellow'

export function renumber(
  highlights: readonly DraftHighlight[],
): DraftHighlight[] {
  return highlights.map((highlight, index) =>
    highlight.position === index + 1
      ? highlight
      : { ...highlight, position: index + 1 },
  )
}

// The key the next 'add' will use, so the UI can focus the new card.
export function nextHighlightKey(state: ReviewState): string {
  return `h${state.nextKey}`
}

// Vocabulary order, deduplicated: the stored lists don't depend on the order
// I tapped the chips in.
function inOrder<T>(order: readonly T[], values: readonly T[]): T[] {
  return order.filter((value) => values.includes(value))
}

function toggle<T>(order: readonly T[], values: readonly T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((v) => v !== value)
    : inOrder(order, [...values, value])
}

export function initReview(
  extracted: readonly ExtractedHighlight[],
): ReviewState {
  // sort() is stable, so highlights sharing a position keep the model's order.
  const sorted = [...extracted].sort((a, b) => a.position - b.position)
  const highlights = sorted.map((highlight, index) => ({
    key: `h${index + 1}`,
    position: highlight.position,
    color: highlight.color,
    text: highlight.text,
    codes: inOrder(CODES, highlight.codes),
    symbols: inOrder(SYMBOLS, highlight.symbols),
  }))
  return { highlights: renumber(highlights), nextKey: sorted.length + 1 }
}

function updateOne(
  state: ReviewState,
  key: string,
  change: (highlight: DraftHighlight) => DraftHighlight,
): ReviewState {
  if (!state.highlights.some((highlight) => highlight.key === key)) {
    return state
  }
  return {
    ...state,
    highlights: state.highlights.map((highlight) =>
      highlight.key === key ? change(highlight) : highlight,
    ),
  }
}

export function reviewReducer(
  state: ReviewState,
  action: ReviewAction,
): ReviewState {
  switch (action.type) {
    case 'editText':
      return updateOne(state, action.key, (h) => ({ ...h, text: action.text }))
    case 'setColor':
      return updateOne(state, action.key, (h) => ({
        ...h,
        color: action.color,
      }))
    case 'toggleCode':
      return updateOne(state, action.key, (h) => ({
        ...h,
        codes: toggle(CODES, h.codes, action.code),
      }))
    case 'toggleSymbol':
      return updateOne(state, action.key, (h) => ({
        ...h,
        symbols: toggle(SYMBOLS, h.symbols, action.symbol),
      }))
    case 'delete': {
      const highlights = state.highlights.filter((h) => h.key !== action.key)
      if (highlights.length === state.highlights.length) return state
      return { ...state, highlights: renumber(highlights) }
    }
    case 'add': {
      // Always added at the end of the page; there's no reordering yet.
      const added: DraftHighlight = {
        key: nextHighlightKey(state),
        position: state.highlights.length + 1,
        color: NEW_HIGHLIGHT_COLOR,
        text: '',
        codes: [],
        symbols: [],
      }
      return {
        highlights: renumber([...state.highlights, added]),
        nextKey: state.nextKey + 1,
      }
    }
  }
}
