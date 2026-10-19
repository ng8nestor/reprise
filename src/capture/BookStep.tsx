import { useEffect, useId, useState, type FormEvent } from 'react'
import { BOOK_KINDS, type BookKind } from '../../shared/vocabulary.ts'
import { addBook, fetchBooks, type Book } from './books.ts'
import { useFocusOnMount } from './useFocusOnMount.ts'

const KIND_NAMES: Record<BookKind, string> = {
  nonfiction: 'Nonfiction',
  biography: 'Biography',
}

type BooksState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; books: Book[] }

interface BookStepProps {
  onPick: (book: Book) => void
  onBack: () => void
}

export function BookStep({ onPick, onBack }: BookStepProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()
  const [books, setBooks] = useState<BooksState>({ status: 'loading' })
  const [adding, setAdding] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    fetchBooks().then(
      (list) => {
        if (active) setBooks({ status: 'ready', books: list })
      },
      () => {
        if (active) setBooks({ status: 'error' })
      },
    )
    return () => {
      active = false
    }
  }, [attempt])

  function retry() {
    setBooks({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  // With no books yet, the form is the only thing to do, so it's shown open.
  const showForm =
    adding || (books.status === 'ready' && books.books.length === 0)

  return (
    <section className="stack" aria-busy={books.status === 'loading'}>
      <h2 ref={headingRef} tabIndex={-1} className="step-heading">
        Which book?
      </h2>

      {books.status === 'loading' && <p className="muted">Loading books…</p>}

      {books.status === 'error' && (
        <div className="stack">
          <p className="form-error" role="alert">
            Couldn't load your books.
          </p>
          <button
            type="button"
            className="button button-secondary"
            onClick={retry}
          >
            Try again
          </button>
        </div>
      )}

      {books.status === 'ready' && books.books.length > 0 && (
        <ul className="option-list">
          {books.books.map((book) => (
            <li key={book.id}>
              <button
                type="button"
                className="option"
                onClick={() => onPick(book)}
              >
                <span className="option-title">{book.title}</span>
                <span className="option-meta">
                  {[book.author, KIND_NAMES[book.kind]]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <AddBookForm
          onAdded={onPick}
          onCancel={
            books.status === 'ready' && books.books.length > 0
              ? () => setAdding(false)
              : undefined
          }
        />
      ) : (
        books.status === 'ready' && (
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setAdding(true)}
          >
            Add a book
          </button>
        )
      )}

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

interface AddBookFormProps {
  onAdded: (book: Book) => void
  onCancel: (() => void) | undefined
}

function AddBookForm({ onAdded, onCancel }: AddBookFormProps) {
  const titleId = useId()
  const authorId = useId()
  const kindName = useId()
  const errorId = useId()
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [kind, setKind] = useState<BookKind | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Add a title.')
      return
    }
    if (!kind) {
      setError('Choose what kind of book it is.')
      return
    }

    setPending(true)
    setError(null)
    try {
      const book = await addBook({
        title: trimmedTitle,
        author: author.trim() || null,
        kind,
      })
      onAdded(book)
    } catch {
      setError("Couldn't add the book. Try again.")
      setPending(false)
    }
  }

  const describedBy = error ? errorId : undefined

  return (
    <form className="card stack" onSubmit={handleSubmit} noValidate>
      <h3 className="form-heading">Add a book</h3>

      <div className="field">
        <label htmlFor={titleId}>Title</label>
        <input
          id={titleId}
          name="title"
          autoComplete="off"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-describedby={describedBy}
        />
      </div>

      <div className="field">
        <label htmlFor={authorId}>
          Author <span className="label-note">(optional)</span>
        </label>
        <input
          id={authorId}
          name="author"
          autoComplete="off"
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
        />
      </div>

      <fieldset className="choice-group" aria-describedby={describedBy}>
        <legend>Kind</legend>
        {BOOK_KINDS.map((value) => (
          <label key={value} className="choice">
            <input
              type="radio"
              name={kindName}
              value={value}
              required
              checked={kind === value}
              onChange={() => setKind(value)}
            />
            {KIND_NAMES[value]}
          </label>
        ))}
      </fieldset>

      <p id={errorId} className="form-error" role="alert">
        {error}
      </p>

      <button
        type="submit"
        className="button button-primary"
        aria-disabled={pending}
      >
        {pending ? 'Adding…' : 'Add and continue'}
      </button>
      {onCancel && (
        <button
          type="button"
          className="button button-secondary"
          onClick={onCancel}
        >
          Cancel
        </button>
      )}
    </form>
  )
}
