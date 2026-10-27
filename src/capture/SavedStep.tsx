import type { Book } from './books.ts'
import { savedHeading } from './save.ts'
import { useFocusOnMount } from './useFocusOnMount.ts'

interface SavedStepProps {
  book: Book
  pageNumber: number
  highlightCount: number
  onNextPage: () => void
  onDone: () => void
}

// A quiet confirmation: no animation (the highlighter sweep is the only one
// the product gets), just what was saved and the two ways forward.
export function SavedStep({
  book,
  pageNumber,
  highlightCount,
  onNextPage,
  onDone,
}: SavedStepProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()

  return (
    <section className="stack">
      <h2 ref={headingRef} tabIndex={-1} className="step-heading">
        {savedHeading(highlightCount)}
      </h2>
      <p className="context">
        {book.title} · p. {pageNumber}
      </p>
      <button
        type="button"
        className="button button-primary"
        onClick={onNextPage}
      >
        Capture next page
      </button>
      <button
        type="button"
        className="button button-secondary"
        onClick={onDone}
      >
        Done
      </button>
    </section>
  )
}
