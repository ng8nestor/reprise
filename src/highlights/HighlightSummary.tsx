import type { ReactNode } from 'react'
import { highlightLabel } from '../capture/highlightLabel.ts'
import type { HighlightSummaryData } from './highlightSummary.ts'
import { MarkList } from './MarkList.tsx'
import '../capture/capture.css'
import './highlightSummary.css'

interface HighlightSummaryProps {
  highlight: HighlightSummaryData
  // Where the highlight is. Off where the screen already says it, like the
  // capture review, so each card stays short.
  showSource?: boolean
  // Its place on the page, shown next to the label ("Highlight 3").
  position?: number
  // A control at the end of the top row, like the review screen's Edit.
  action?: ReactNode
}

// A compact, read-only highlight: the quote on its tint, what the color
// means for this book, where it is, and the codes and symbols next to it.
// Static on purpose: the highlighter sweep belongs to the review card.
export function HighlightSummary({
  highlight,
  showSource = true,
  position,
  action,
}: HighlightSummaryProps) {
  const isEmpty = highlight.text.trim() === ''

  return (
    <article
      className="card highlight-card highlight-summary"
      data-color={highlight.color}
      aria-label={position === undefined ? undefined : `Highlight ${position}`}
    >
      <div className="summary-head">
        <p className="summary-meta">
          <span className="highlight-tag">
            {highlightLabel(highlight.kind, highlight.color)}
          </span>
          {position !== undefined && (
            <span className="muted">Highlight {position}</span>
          )}
        </p>
        {action}
      </div>
      <blockquote className="summary-quote">
        <p>
          {isEmpty ? (
            <span className="summary-empty">No text yet</span>
          ) : (
            highlight.text
          )}
        </p>
      </blockquote>
      {showSource && (
        <p className="context">
          {highlight.bookTitle} · p. {highlight.pageNumber}
        </p>
      )}
      <MarkList codes={highlight.codes} symbols={highlight.symbols} />
    </article>
  )
}
