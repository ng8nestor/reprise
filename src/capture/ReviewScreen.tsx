import { useEffect, useId, useReducer, useRef, useState } from 'react'
import type { Book } from './books.ts'
import type { ExtractResponse } from './extractClient.ts'
import { HighlightCard } from './HighlightCard.tsx'
import {
  initReview,
  nextHighlightKey,
  reviewReducer,
  type DraftHighlight,
} from './review.ts'
import { blankHighlightKeys, blankHighlightsMessage } from './save.ts'
import { saveErrorMessage, type SaveFailure } from './saveError.ts'
import { useFocusOnMount } from './useFocusOnMount.ts'

interface ReviewScreenProps {
  book: Book
  pageNumber: number
  photoUrl: string
  extraction: ExtractResponse
  // Resolves to null once saved (the flow then moves on and this screen
  // unmounts), or to why it failed (this screen stays, edits intact).
  onSave: (highlights: DraftHighlight[]) => Promise<SaveFailure | null>
  onRetake: () => void
  onDiscard: () => void
}

export function ReviewScreen({
  book,
  pageNumber,
  photoUrl,
  extraction,
  onSave,
  onRetake,
  onDiscard,
}: ReviewScreenProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()
  const listRef = useRef<HTMLOListElement>(null)
  const saveMessageId = useId()
  const [state, dispatch] = useReducer(
    reviewReducer,
    extraction.highlights,
    initReview,
  )
  // The card added last gets focus when it mounts.
  const [focusKey, setFocusKey] = useState<string | null>(null)

  // A ref, not just state: two taps in a row must never start two saves,
  // even before React re-renders.
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Empty cards are only flagged after a save attempt, then live: the
  // message goes away as soon as each card gets text or is deleted.
  const [checkBlank, setCheckBlank] = useState(false)
  // Bumped on each blocked save, to move focus to the first empty card.
  const [blankAttempt, setBlankAttempt] = useState(0)

  const count = state.highlights.length
  const blankKeys = checkBlank ? blankHighlightKeys(state.highlights) : []
  const blankPositions = state.highlights
    .filter((highlight) => blankKeys.includes(highlight.key))
    .map((highlight) => highlight.position)
  const saveMessage =
    blankPositions.length > 0
      ? blankHighlightsMessage(blankPositions)
      : saveError

  useEffect(() => {
    if (blankAttempt === 0) return
    listRef.current
      ?.querySelector<HTMLElement>('textarea[aria-invalid="true"]')
      ?.focus()
  }, [blankAttempt])

  function handleAdd() {
    setFocusKey(nextHighlightKey(state))
    dispatch({ type: 'add' })
  }

  function handleDelete(key: string) {
    dispatch({ type: 'delete', key })
    // The focused button just disappeared; land on the heading instead.
    headingRef.current?.focus()
  }

  async function handleSave() {
    if (savingRef.current) return

    const highlights = state.highlights
    if (blankHighlightKeys(highlights).length > 0) {
      setSaveError(null)
      setCheckBlank(true)
      setBlankAttempt((attempt) => attempt + 1)
      return
    }

    savingRef.current = true
    setSaving(true)
    setSaveError(null)
    const failure = await onSave(highlights)
    if (failure === null) return
    savingRef.current = false
    setSaving(false)
    setSaveError(saveErrorMessage(failure, pageNumber))
  }

  return (
    <section className="stack" aria-busy={saving}>
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
        <ol ref={listRef} className="highlight-list">
          {state.highlights.map((highlight) => (
            <HighlightCard
              key={highlight.key}
              highlight={highlight}
              kind={book.kind}
              focusOnMount={highlight.key === focusKey}
              blank={blankKeys.includes(highlight.key)}
              dispatch={dispatch}
              onDelete={() => handleDelete(highlight.key)}
            />
          ))}
        </ol>
      )}

      <button
        type="button"
        className="button button-secondary"
        disabled={saving}
        onClick={handleAdd}
      >
        Add a highlight
      </button>

      <div className="save-area">
        {/* aria-disabled instead of disabled: a disabled button drops
            keyboard focus to <body>; this keeps focus on it while saving,
            and savingRef ignores the extra taps. */}
        <button
          type="button"
          className="button button-primary"
          aria-disabled={saving}
          aria-describedby={saveMessage ? saveMessageId : undefined}
          onClick={() => void handleSave()}
        >
          {saving ? 'Saving…' : 'Save page'}
        </button>
        {/* Always rendered so screen readers announce the text when it
            appears. */}
        <p id={saveMessageId} className="form-error" role="alert">
          {saveMessage}
        </p>
      </div>

      <button
        type="button"
        className="button button-secondary"
        disabled={saving}
        onClick={onRetake}
      >
        Retake photo
      </button>
      <button
        type="button"
        className="button button-secondary"
        disabled={saving}
        onClick={onDiscard}
      >
        Discard page
      </button>
    </section>
  )
}
