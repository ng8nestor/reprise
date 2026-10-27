import { useId, useReducer, useState } from 'react'
import type { Book } from './books.ts'
import type { ExtractResponse } from './extractClient.ts'
import { HighlightCard } from './HighlightCard.tsx'
import { initReview, nextHighlightKey, reviewReducer } from './review.ts'
import { useFocusOnMount } from './useFocusOnMount.ts'

interface ReviewScreenProps {
  book: Book
  pageNumber: number
  photoUrl: string
  extraction: ExtractResponse
  onRetake: () => void
  onDiscard: () => void
}

export function ReviewScreen({
  book,
  pageNumber,
  photoUrl,
  extraction,
  onRetake,
  onDiscard,
}: ReviewScreenProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()
  const saveNoteId = useId()
  const [state, dispatch] = useReducer(
    reviewReducer,
    extraction.highlights,
    initReview,
  )
  // The card added last gets focus when it mounts.
  const [focusKey, setFocusKey] = useState<string | null>(null)

  const count = state.highlights.length

  function handleAdd() {
    setFocusKey(nextHighlightKey(state))
    dispatch({ type: 'add' })
  }

  function handleDelete(key: string) {
    dispatch({ type: 'delete', key })
    // The focused button just disappeared; land on the heading instead.
    headingRef.current?.focus()
  }

  return (
    <section className="stack">
      <h2 ref={headingRef} tabIndex={-1} className="step-heading">
        Review highlights
      </h2>
      <p className="context">
        {book.title} · p. {pageNumber} · {count}{' '}
        {count === 1 ? 'highlight' : 'highlights'}
      </p>

      {extraction.warnings.length > 0 && (
        <section className="warnings" aria-label="Notes from the reader">
          <ul>
            {extraction.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        </section>
      )}

      <details className="photo-details">
        <summary>Show the photo</summary>
        <img className="photo" src={photoUrl} alt="The page you photographed" />
      </details>

      {count === 0 ? (
        <p className="empty">
          No highlights found on this page. If there are some, add them below.
        </p>
      ) : (
        <ol className="highlight-list">
          {state.highlights.map((highlight) => (
            <HighlightCard
              key={highlight.key}
              highlight={highlight}
              kind={book.kind}
              focusOnMount={highlight.key === focusKey}
              dispatch={dispatch}
              onDelete={() => handleDelete(highlight.key)}
            />
          ))}
        </ol>
      )}

      <button
        type="button"
        className="button button-secondary"
        onClick={handleAdd}
      >
        Add a highlight
      </button>

      <div className="save-area">
        <button
          type="button"
          className="button button-primary"
          disabled
          aria-describedby={saveNoteId}
        >
          Save page
        </button>
        <p id={saveNoteId} className="muted">
          Saving comes next.
        </p>
      </div>

      <button
        type="button"
        className="button button-secondary"
        onClick={onRetake}
      >
        Retake photo
      </button>
      <button
        type="button"
        className="button button-secondary"
        onClick={onDiscard}
      >
        Discard page
      </button>
    </section>
  )
}
