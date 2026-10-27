import { useId, type Dispatch } from 'react'
import {
  CODES,
  COLORS,
  SYMBOL_GLYPHS,
  SYMBOLS,
  type BookKind,
  type Color,
  type SymbolName,
} from '../../shared/vocabulary.ts'
import { highlightLabel } from './highlightLabel.ts'
import type { DraftHighlight, ReviewAction } from './review.ts'

const COLOR_NAMES: Record<Color, string> = { pink: 'Pink', yellow: 'Yellow' }

// Spoken names for the margin symbols; the glyph alone reads badly.
const SYMBOL_NAMES: Record<SymbolName, string> = {
  try: 'Try',
  doubt: 'Doubt',
  surprise: 'Surprise',
  disagree: 'Disagree',
  connects: 'Connects',
}

interface HighlightCardProps {
  highlight: DraftHighlight
  kind: BookKind
  focusOnMount: boolean
  // True when a save was blocked because this card has no text.
  blank: boolean
  dispatch: Dispatch<ReviewAction>
  onDelete: () => void
}

export function HighlightCard({
  highlight,
  kind,
  focusOnMount,
  blank,
  dispatch,
  onDelete,
}: HighlightCardProps) {
  const id = useId()
  const textId = `${id}-text`
  const errorId = `${id}-error`
  const { key } = highlight

  return (
    <li className="card highlight-card stack" data-color={highlight.color}>
      <label htmlFor={textId} className="highlight-card-head">
        <span className="highlight-tag">
          {highlightLabel(kind, highlight.color)}
        </span>
        <span className="muted">Highlight {highlight.position}</span>
      </label>
      <textarea
        id={textId}
        className="quote-input"
        rows={3}
        placeholder="Type the highlighted text"
        // Only true for a card just added by hand.
        autoFocus={focusOnMount}
        value={highlight.text}
        onChange={(event) =>
          dispatch({ type: 'editText', key, text: event.target.value })
        }
        aria-invalid={blank ? true : undefined}
        aria-describedby={blank ? errorId : undefined}
      />
      {blank && (
        <p id={errorId} className="form-error">
          This highlight is empty.
        </p>
      )}

      <fieldset className="chip-group">
        <legend>Color</legend>
        <div className="chip-row">
          {COLORS.map((color) => (
            <label key={color} className="chip">
              <input
                type="radio"
                className="visually-hidden"
                name={`${id}-color`}
                checked={highlight.color === color}
                onChange={() => dispatch({ type: 'setColor', key, color })}
              />
              <span className={`swatch swatch-${color}`} aria-hidden="true" />
              {COLOR_NAMES[color]} · {highlightLabel(kind, color)}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="chip-group">
        <legend>Codes</legend>
        <div className="chip-row">
          {CODES.map((code) => (
            <button
              key={code}
              type="button"
              className="chip"
              aria-pressed={highlight.codes.includes(code)}
              onClick={() => dispatch({ type: 'toggleCode', key, code })}
            >
              {code}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="chip-group">
        <legend>Symbols</legend>
        <div className="chip-row">
          {SYMBOLS.map((symbol) => (
            <button
              key={symbol}
              type="button"
              className="chip chip-symbol"
              aria-pressed={highlight.symbols.includes(symbol)}
              aria-label={SYMBOL_NAMES[symbol]}
              title={SYMBOL_NAMES[symbol]}
              onClick={() => dispatch({ type: 'toggleSymbol', key, symbol })}
            >
              {SYMBOL_GLYPHS[symbol]}
            </button>
          ))}
        </div>
      </fieldset>

      <button type="button" className="button button-danger" onClick={onDelete}>
        Delete highlight
      </button>
    </li>
  )
}
