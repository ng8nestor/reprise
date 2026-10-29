import { useId, type Dispatch } from 'react'
import {
  CODES,
  COLORS,
  SYMBOL_GLYPHS,
  SYMBOL_NAMES,
  SYMBOLS,
  type BookKind,
  type Color,
} from '../../shared/vocabulary.ts'
import { highlightLabel } from './highlightLabel.ts'
import type { DraftHighlight, ReviewAction } from './review.ts'

const COLOR_NAMES: Record<Color, string> = { pink: 'Pink', yellow: 'Yellow' }

interface HighlightCardProps {
  highlight: DraftHighlight
  kind: BookKind
  // True when a save was blocked because this card has no text.
  blank: boolean
  dispatch: Dispatch<ReviewAction>
  onDone: () => void
  onDelete: () => void
}

// The full controls for one highlight, shown while it's open for editing.
// The review screen moves focus by the data-focus markers: "panel" for the
// card itself (when it opens), "text" for the textarea.
export function HighlightCard({
  highlight,
  kind,
  blank,
  dispatch,
  onDone,
  onDelete,
}: HighlightCardProps) {
  const id = useId()
  const textId = `${id}-text`
  const errorId = `${id}-error`
  const { key } = highlight

  return (
    <article
      className="card highlight-card stack"
      data-color={highlight.color}
      data-focus="panel"
      tabIndex={-1}
      aria-label={`Highlight ${highlight.position}`}
    >
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
        data-focus="text"
        placeholder="Type the highlighted text"
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

      <div className="card-actions">
        <button
          type="button"
          className="button button-danger"
          aria-label={`Delete highlight ${highlight.position}`}
          onClick={onDelete}
        >
          Delete
        </button>
        <button
          type="button"
          className="button button-secondary"
          aria-label={`Done editing highlight ${highlight.position}`}
          onClick={onDone}
        >
          Done
        </button>
      </div>
    </article>
  )
}
