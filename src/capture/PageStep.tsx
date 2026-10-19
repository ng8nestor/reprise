import { useId, useState, type FormEvent } from 'react'
import type { Book } from './books.ts'
import { parsePageNumber } from './pageNumber.ts'
import { useFocusOnMount } from './useFocusOnMount.ts'

interface PageStepProps {
  book: Book
  initialPage: number | null
  onSubmit: (pageNumber: number) => void
  onBack: () => void
}

export function PageStep({
  book,
  initialPage,
  onSubmit,
  onBack,
}: PageStepProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()
  const inputId = useId()
  const errorId = useId()
  const [value, setValue] = useState(initialPage ? String(initialPage) : '')
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const pageNumber = parsePageNumber(value)
    if (pageNumber === null) {
      setError('Enter a page number above 0.')
      return
    }
    onSubmit(pageNumber)
  }

  return (
    <section className="stack">
      <h2 ref={headingRef} tabIndex={-1} className="step-heading">
        Which page?
      </h2>
      <p className="context">{book.title}</p>

      <form className="stack" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor={inputId}>Page number</label>
          {/* text + inputmode, not type="number": no spinner, no "e" or
              decimals, and the phone shows the digit keypad. */}
          <input
            id={inputId}
            name="page"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            required
            value={value}
            onChange={(event) => setValue(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </div>

        <p id={errorId} className="form-error" role="alert">
          {error}
        </p>

        <button type="submit" className="button button-primary">
          Continue
        </button>
      </form>

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
