import { useRef, type ChangeEvent } from 'react'
import type { Book } from './books.ts'
import { useFocusOnMount } from './useFocusOnMount.ts'

interface PhotoStepProps {
  book: Book
  pageNumber: number
  preparing: boolean
  error: string | null
  onPhoto: (file: File) => void
  onBack: () => void
}

export function PhotoStep({
  book,
  pageNumber,
  preparing,
  error,
  onPhoto,
  onBack,
}: PhotoStepProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Cleared so picking the same file again still fires a change.
    event.target.value = ''
    if (file) onPhoto(file)
  }

  return (
    <section className="stack" aria-busy={preparing}>
      <h2 ref={headingRef} tabIndex={-1} className="step-heading">
        Photograph the page
      </h2>
      <p className="context">
        {book.title} · p. {pageNumber}
      </p>

      {/* capture="environment" opens the back camera on a phone; on a
          laptop it falls back to a file picker. The visible button opens
          it, since a file input can't be styled. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handleChange}
      />

      <p className="form-error" role="alert">
        {error}
      </p>

      <button
        type="button"
        className="button button-primary"
        aria-disabled={preparing}
        onClick={() => {
          if (!preparing) inputRef.current?.click()
        }}
      >
        {preparing ? 'Preparing photo…' : 'Take photo'}
      </button>

      <button
        type="button"
        className="button button-secondary"
        onClick={onBack}
      >
        Back
      </button>
    </section>
  )
}
