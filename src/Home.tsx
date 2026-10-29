import { useEffect, useRef, useState } from 'react'
import { fetchReviewQueue } from './review/queue.ts'
import { reviewButtonLabel } from './review/reviewCard.ts'

// How many highlights today's review would show. "unknown" when the count
// couldn't be loaded: review is still offered, without a number, and the
// review screen shows its own error if it can't load either.
type DueState =
  | { status: 'loading' }
  | { status: 'ready'; count: number }
  | { status: 'unknown' }

interface HomeProps {
  onCapture: () => void
  onReview: () => void
  // True when coming back from another screen, so focus lands here
  // instead of on <body>. False on first load, so the page reads from the top.
  focusOnMount: boolean
}

export function Home({ onCapture, onReview, focusOnMount }: HomeProps) {
  const focalRef = useRef<HTMLButtonElement>(null)
  const [due, setDue] = useState<DueState>({ status: 'loading' })

  // Home mounts again every time I come back to it, so the count is fresh
  // after a review or a capture.
  useEffect(() => {
    let active = true
    fetchReviewQueue(new Date()).then(
      (cards) => {
        if (active) setDue({ status: 'ready', count: cards.length })
      },
      () => {
        if (active) setDue({ status: 'unknown' })
      },
    )
    return () => {
      active = false
    }
  }, [])

  // Waits for the count, because which button is focal depends on it.
  useEffect(() => {
    if (focusOnMount && due.status !== 'loading') focalRef.current?.focus()
  }, [focusOnMount, due.status])

  // Nothing is shown until the count arrives, so the focal button never
  // swaps places under my thumb. Capture needs the same server anyway.
  if (due.status === 'loading') {
    return (
      <section className="home" aria-busy="true">
        <p className="muted">Loading…</p>
      </section>
    )
  }

  const reviewFocal = due.status === 'ready' && due.count > 0

  return (
    <section className="home">
      {reviewFocal && (
        <button
          ref={focalRef}
          type="button"
          className="button button-primary button-focal"
          onClick={onReview}
        >
          {reviewButtonLabel(due.count)}
        </button>
      )}
      <button
        ref={reviewFocal ? undefined : focalRef}
        type="button"
        className={
          reviewFocal
            ? 'button button-secondary'
            : 'button button-primary button-focal'
        }
        onClick={onCapture}
      >
        Capture a page
      </button>
      {due.status === 'unknown' && (
        <button
          type="button"
          className="button button-secondary"
          onClick={onReview}
        >
          Review today
        </button>
      )}
    </section>
  )
}
