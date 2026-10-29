import { SYMBOL_GLYPHS, SYMBOL_NAMES } from '../../shared/vocabulary.ts'
import { highlightLabel } from '../capture/highlightLabel.ts'
import type { HighlightSummaryData } from './highlightSummary.ts'
import '../capture/capture.css'
import '../review/review.css'
import './highlightSummary.css'

interface HighlightSummaryProps {
  highlight: HighlightSummaryData
}

// A compact, read-only highlight: the quote on its tint, what the color
// means for this book, where it is, and the codes and symbols next to it.
// Static on purpose: the highlighter sweep belongs to the review card.
export function HighlightSummary({ highlight }: HighlightSummaryProps) {
  const hasMarks = highlight.codes.length > 0 || highlight.symbols.length > 0

  return (
    <article
      className="card highlight-card highlight-summary"
      data-color={highlight.color}
    >
      <p className="summary-head">
        <span className="highlight-tag">
          {highlightLabel(highlight.kind, highlight.color)}
        </span>
      </p>
      <blockquote className="summary-quote">
        <p>{highlight.text}</p>
      </blockquote>
      <p className="context">
        {highlight.bookTitle} · p. {highlight.pageNumber}
      </p>
      {hasMarks && (
        <ul className="mark-list" aria-label="Codes and symbols">
          {highlight.codes.map((code) => (
            <li key={code} className="mark">
              {code}
            </li>
          ))}
          {highlight.symbols.map((symbol) => (
            <li key={symbol} className="mark">
              <span aria-hidden="true">{SYMBOL_GLYPHS[symbol]}</span>
              {SYMBOL_NAMES[symbol]}
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}
