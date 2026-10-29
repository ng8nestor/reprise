import { useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import { highlightLabel } from '../capture/highlightLabel.ts'
import { gradeErrorMessage } from '../capture/saveError.ts'
import { useFocusOnMount } from '../capture/useFocusOnMount.ts'
import { MarkList } from '../highlights/MarkList.tsx'
import { fetchReviewQueue, saveGrade } from './queue.ts'
import { progressLabel, type ReviewCard } from './reviewCard.ts'
import type { Grade } from './scheduler.ts'
import '../capture/capture.css'
import './review.css'

type QueueState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'empty' }
  | { status: 'ready'; cards: ReviewCard[]; index: number }
  | { status: 'done' }

interface DailyReviewProps {
  onExit: () => void
}

// Today's due highlights, one card at a time. Each grade is saved before
// the next card shows, so leaving halfway keeps everything graded so far.
export function DailyReview({ onExit }: DailyReviewProps) {
  const [state, setState] = useState<QueueState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    fetchReviewQueue(new Date()).then(
      (cards) => {
        if (!active) return
        setState(
          cards.length === 0
            ? { status: 'empty' }
            : { status: 'ready', cards, index: 0 },
        )
      },
      () => {
        if (active) setState({ status: 'error' })
      },
    )
    return () => {
      active = false
    }
  }, [attempt])

  function retry() {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  switch (state.status) {
    case 'empty':
      return <EndState heading="Nothing to review today" onExit={onExit} />
    case 'done':
      return <EndState heading="All done for today" onExit={onExit} />
    case 'loading':
    case 'error':
      return (
        <QueueStatus
          failed={state.status === 'error'}
          onRetry={retry}
          onExit={onExit}
        />
      )
    case 'ready':
      return (
        <CardSession
          cards={state.cards}
          index={state.index}
          onNext={() =>
            setState(
              state.index + 1 < state.cards.length
                ? { ...state, index: state.index + 1 }
                : { status: 'done' },
            )
          }
          onExit={onExit}
        />
      )
  }
}

interface QueueStatusProps {
  failed: boolean
  onRetry: () => void
  onExit: () => void
}

function QueueStatus({ failed, onRetry, onExit }: QueueStatusProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()

  return (
    <section className="stack" aria-busy={!failed}>
      <h2 ref={headingRef} tabIndex={-1} className="step-heading">
        Today's review
      </h2>
      {failed ? (
        <>
          <p className="form-error" role="alert">
            Couldn't load today's review.
          </p>
          <button
            type="button"
            className="button button-secondary"
            onClick={onRetry}
          >
            Try again
          </button>
        </>
      ) : (
        <p className="muted">Loading…</p>
      )}
      <button
        type="button"
        className="button button-secondary"
        onClick={onExit}
      >
        Back to Home
      </button>
    </section>
  )
}

interface CardSessionProps {
  cards: ReviewCard[]
  index: number
  onNext: () => void
  onExit: () => void
}

function CardSession({ cards, index, onNext, onExit }: CardSessionProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()
  const errorId = useId()
  // A ref, not just state: a second tap must never start a second save,
  // even before React re-renders.
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const card = cards[index]
  if (!card) return null

  async function grade(event: MouseEvent<HTMLButtonElement>, value: Grade) {
    // detail is the click count: 2+ is the second tap of a double tap,
    // which would otherwise grade the next card the moment it appears.
    // Keyboard presses report 0.
    if (event.detail > 1 || savingRef.current || !card) return
    savingRef.current = true
    setSaving(true)
    setError(null)
    const failure = await saveGrade(card, value, new Date())
    savingRef.current = false
    setSaving(false)
    if (failure === null) onNext()
    else setError(gradeErrorMessage(failure))
  }

  return (
    <section className="stack" aria-busy={saving}>
      <h2 ref={headingRef} tabIndex={-1} className="step-heading">
        Today's review
      </h2>

      {/* The buttons below stay put while the card changes, so focus stays
          on the button I pressed; this region reads each new card out. */}
      <div className="stack" aria-live="polite">
        <p className="context">{progressLabel(index, cards.length)}</p>
        {/* Keyed by highlight, so each card mounts fresh and the sweep
            plays again. */}
        <CardView key={card.id} card={card} />
      </div>

      <div className="grade-buttons">
        <button
          type="button"
          className="button button-secondary"
          aria-describedby={error ? errorId : undefined}
          onClick={(event) => void grade(event, 'again')}
        >
          Again
        </button>
        <button
          type="button"
          className="button button-primary"
          aria-describedby={error ? errorId : undefined}
          onClick={(event) => void grade(event, 'knowIt')}
        >
          Know it
        </button>
      </div>
      {/* Always rendered so screen readers announce the text when it
          appears. */}
      <p id={errorId} className="form-error" role="alert">
        {error}
      </p>

      <button
        type="button"
        className="button button-secondary"
        onClick={onExit}
      >
        Back to Home
      </button>
    </section>
  )
}

function CardView({ card }: { card: ReviewCard }) {
  return (
    <article className="card highlight-card stack" data-color={card.color}>
      <p className="review-card-head">
        <span className="highlight-tag">
          {highlightLabel(card.kind, card.color)}
        </span>
      </p>
      <blockquote className="review-quote">
        <p>
          <span className="review-quote-text">{card.text}</span>
        </p>
      </blockquote>
      <p className="context">
        {card.bookTitle} · p. {card.pageNumber}
      </p>
      <MarkList codes={card.codes} symbols={card.symbols} />
    </article>
  )
}

interface EndStateProps {
  heading: string
  onExit: () => void
}

function EndState({ heading, onExit }: EndStateProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()

  return (
    <section className="stack">
      <h2 ref={headingRef} tabIndex={-1} className="step-heading">
        {heading}
      </h2>
      <button type="button" className="button button-primary" onClick={onExit}>
        Back to Home
      </button>
    </section>
  )
}
