import { useEffect, useId, useReducer, useRef, useState } from 'react'
import { HighlightSummary } from '../highlights/HighlightSummary.tsx'
import type { Book } from './books.ts'
import {
  keyAfterDelete,
  nextExpanded,
  type ExpandedKey,
} from './expandedCard.ts'
import type { ExtractResponse } from './extractClient.ts'
import { HighlightCard } from './HighlightCard.tsx'
import {
  initReview,
  nextHighlightKey,
  reviewReducer,
  type DraftHighlight,
} from './review.ts'
import {
  blankHighlightKeys,
  blankHighlightsMessage,
  saveButtonLabel,
} from './save.ts'
import { saveErrorMessage, type SaveFailure } from './saveError.ts'
import { useFocusOnMount } from './useFocusOnMount.ts'

// Where focus goes after a change, found by the data-focus markers in
// HighlightSummary's Edit button and in HighlightCard.
interface FocusRequest {
  key: string
  target: 'edit' | 'panel' | 'text'
}

function highlightCount(count: number): string {
  return `${count} ${count === 1 ? 'highlight' : 'highlights'}`
}

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
  // Every card starts collapsed: a correct extraction is scroll, glance, Save.
  const [expanded, setExpanded] = useState<ExpandedKey>(null)
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null)
  // Read out by screen readers; the focus move alone doesn't say a card
  // opened or closed.
  const [announcement, setAnnouncement] = useState('')

  // A ref, not just state: two taps in a row must never start two saves,
  // even before React re-renders.
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Empty cards are only flagged after a save attempt, then live: the
  // message goes away as soon as each card gets text or is deleted.
  const [checkBlank, setCheckBlank] = useState(false)

  const count = state.highlights.length
  const blankKeys = checkBlank ? blankHighlightKeys(state.highlights) : []
  const blankPositions = state.highlights
    .filter((highlight) => blankKeys.includes(highlight.key))
    .map((highlight) => highlight.position)
  const saveMessage =
    blankPositions.length > 0
      ? blankHighlightsMessage(blankPositions)
      : saveError

  // Runs after the render that opened or closed a card, so the element to
  // focus exists. A new object per request, so asking for the same target
  // twice still moves focus again.
  useEffect(() => {
    if (!focusRequest) return
    listRef.current
      ?.querySelector<HTMLElement>(
        `[data-key="${focusRequest.key}"] [data-focus="${focusRequest.target}"]`,
      )
      ?.focus()
  }, [focusRequest])

  function positionOf(key: string): number {
    return state.highlights.find((h) => h.key === key)?.position ?? 0
  }

  function handleOpen(key: string) {
    setExpanded(nextExpanded(expanded, { type: 'open', key }))
    // The card itself, not its textarea: the on-screen keyboard shouldn't
    // pop up when I only came to change a code.
    setFocusRequest({ key, target: 'panel' })
    setAnnouncement(`Highlight ${positionOf(key)} open for editing.`)
  }

  function handleDone(key: string) {
    setExpanded(nextExpanded(expanded, { type: 'close', key }))
    // The Done button just disappeared; land on this card's Edit button.
    setFocusRequest({ key, target: 'edit' })
    setAnnouncement(`Highlight ${positionOf(key)} closed.`)
  }

  function handleAdd() {
    const key = nextHighlightKey(state)
    dispatch({ type: 'add' })
    setExpanded(nextExpanded(expanded, { type: 'add', key }))
    setFocusRequest({ key, target: 'text' })
    setAnnouncement(`Highlight ${count + 1} added. Type its text.`)
  }

  function handleDelete(key: string) {
    const neighbor = keyAfterDelete(
      state.highlights.map((highlight) => highlight.key),
      key,
    )
    dispatch({ type: 'delete', key })
    setExpanded(nextExpanded(expanded, { type: 'delete', key }))
    setAnnouncement(
      `Highlight ${positionOf(key)} deleted. ${highlightCount(count - 1)} left.`,
    )
    // The focused button just disappeared. Stay near where I was if a card
    // is left; otherwise land on the heading.
    if (neighbor) setFocusRequest({ key: neighbor, target: 'edit' })
    else headingRef.current?.focus()
  }

  async function handleSave() {
    if (savingRef.current) return

    const highlights = state.highlights
    const emptyKeys = blankHighlightKeys(highlights)
    const firstBlank = emptyKeys[0]
    if (firstBlank !== undefined) {
      setSaveError(null)
      setCheckBlank(true)
      // Open the first empty card and put the cursor in it; the message
      // below names every empty one.
      setExpanded(
        nextExpanded(expanded, { type: 'blockedSave', blankKeys: emptyKeys }),
      )
      setFocusRequest({ key: firstBlank, target: 'text' })
      setAnnouncement(`Highlight ${positionOf(firstBlank)} open for editing.`)
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
        {book.title} · p. {pageNumber} · {highlightCount(count)}
      </p>
      <p role="status" className="visually-hidden">
        {announcement}
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
            <li key={highlight.key} data-key={highlight.key}>
              {highlight.key === expanded ? (
                <HighlightCard
                  highlight={highlight}
                  kind={book.kind}
                  blank={blankKeys.includes(highlight.key)}
                  dispatch={dispatch}
                  onDone={() => handleDone(highlight.key)}
                  onDelete={() => handleDelete(highlight.key)}
                />
              ) : (
                <HighlightSummary
                  highlight={{
                    id: highlight.key,
                    text: highlight.text,
                    color: highlight.color,
                    kind: book.kind,
                    bookTitle: book.title,
                    pageNumber,
                    codes: highlight.codes,
                    symbols: highlight.symbols,
                  }}
                  showSource={false}
                  position={highlight.position}
                  action={
                    <button
                      type="button"
                      className="button button-secondary"
                      data-focus="edit"
                      aria-label={`Edit highlight ${highlight.position}`}
                      onClick={() => handleOpen(highlight.key)}
                    >
                      Edit
                    </button>
                  }
                />
              )}
              {blankKeys.includes(highlight.key) &&
                highlight.key !== expanded && (
                  <p className="form-error">This highlight is empty.</p>
                )}
            </li>
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

      <div className="quiet-actions">
        <button
          type="button"
          className="button button-quiet"
          disabled={saving}
          onClick={onRetake}
        >
          Retake photo
        </button>
        <button
          type="button"
          className="button button-quiet"
          disabled={saving}
          onClick={onDiscard}
        >
          Discard page
        </button>
      </div>

      {/* Last on purpose: it sticks to the bottom of the screen while the
          cards scroll, and rests here at the end of the page. */}
      <div className="save-bar">
        {/* Always rendered so screen readers announce the text when it
            appears. */}
        <p id={saveMessageId} className="form-error" role="alert">
          {saveMessage}
        </p>
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
          {saving ? 'Saving…' : saveButtonLabel(count)}
        </button>
      </div>
    </section>
  )
}
