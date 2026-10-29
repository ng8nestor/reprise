import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { CODES, COLORS } from '../../shared/vocabulary.ts'
import { fetchBooks, type Book } from '../capture/books.ts'
import { useFocusOnMount } from '../capture/useFocusOnMount.ts'
import { HighlightSummary } from '../highlights/HighlightSummary.tsx'
import type { HighlightSummaryData } from '../highlights/highlightSummary.ts'
import { fetchHighlightPage } from './browse.ts'
import {
  NO_FILTERS,
  bookFilterLabel,
  colorFilterLabel,
  hasActiveFilters,
  parseCode,
  type BrowseFilters,
} from './browseFilters.ts'
import { BROWSE_PAGE_SIZE, loadedCountLabel } from './browsePage.ts'
import '../capture/capture.css'
import './browse.css'

type BooksState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; books: Book[] }

type MoreState = 'idle' | 'loading' | 'error'

type ListState =
  | { status: 'loading' }
  | { status: 'error' }
  | {
      status: 'ready'
      items: HighlightSummaryData[]
      hasMore: boolean
      // Where the next page starts, counted in database rows.
      nextOffset: number
      more: MoreState
    }

interface BrowseHighlightsProps {
  onCapture: () => void
  onExit: () => void
}

// All my saved highlights, a page at a time, narrowed by book, color and
// code. The filters run in the database; this only holds what is loaded.
export function BrowseHighlights({ onCapture, onExit }: BrowseHighlightsProps) {
  const headingRef = useFocusOnMount<HTMLHeadingElement>()
  const bookSelectRef = useRef<HTMLSelectElement>(null)
  const countRef = useRef<HTMLParagraphElement>(null)
  // Set when "Load more" loads the last page, so focus can move off the
  // button as it disappears.
  const focusCountRef = useRef(false)

  const [filters, setFilters] = useState<BrowseFilters>(NO_FILTERS)
  const [list, setList] = useState<ListState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [books, setBooks] = useState<BooksState>({ status: 'loading' })
  const [booksAttempt, setBooksAttempt] = useState(0)

  useEffect(() => {
    let active = true
    fetchBooks().then(
      (all) => {
        if (active) setBooks({ status: 'ready', books: all })
      },
      () => {
        if (active) setBooks({ status: 'error' })
      },
    )
    return () => {
      active = false
    }
  }, [booksAttempt])

  // The first page, whenever the filters change or I retry. Changing the
  // filters drops what was loaded, so a late "Load more" reply for the old
  // filters is ignored (see loadMore).
  useEffect(() => {
    let active = true
    fetchHighlightPage(filters, 0).then(
      (page) => {
        if (!active) return
        setList({
          status: 'ready',
          items: page.rows,
          hasMore: page.hasMore,
          nextOffset: BROWSE_PAGE_SIZE,
          more: 'idle',
        })
      },
      () => {
        if (active) setList({ status: 'error' })
      },
    )
    return () => {
      active = false
    }
  }, [filters, attempt])

  useEffect(() => {
    if (focusCountRef.current && list.status === 'ready') {
      focusCountRef.current = false
      countRef.current?.focus()
    }
  }, [list])

  function changeFilters(next: BrowseFilters) {
    setFilters(next)
    setList({ status: 'loading' })
  }

  function clearFilters() {
    changeFilters(NO_FILTERS)
    // The button I pressed is about to go away.
    bookSelectRef.current?.focus()
  }

  function retry() {
    setList({ status: 'loading' })
    setAttempt((n) => n + 1)
  }

  function retryBooks() {
    setBooks({ status: 'loading' })
    setBooksAttempt((n) => n + 1)
  }

  async function loadMore() {
    if (list.status !== 'ready' || list.more === 'loading') return
    const loading: ListState = { ...list, more: 'loading' }
    setList(loading)
    try {
      const page = await fetchHighlightPage(filters, list.nextOffset)
      // Applies only if the list is still the one this started from: new
      // filters or a retry replace it, and their results win.
      if (!page.hasMore) focusCountRef.current = true
      setList((current) =>
        current === loading
          ? {
              status: 'ready',
              items: [...loading.items, ...page.rows],
              hasMore: page.hasMore,
              nextOffset: loading.nextOffset + BROWSE_PAGE_SIZE,
              more: 'idle',
            }
          : current,
      )
    } catch {
      setList((current) =>
        current === loading ? { ...loading, more: 'error' } : current,
      )
    }
  }

  return (
    <section className="stack" aria-busy={list.status === 'loading'}>
      <h2 ref={headingRef} tabIndex={-1} className="step-heading">
        Browse highlights
      </h2>

      <button
        type="button"
        className="button button-secondary"
        onClick={onExit}
      >
        Back to Home
      </button>

      <Filters
        filters={filters}
        books={books}
        bookSelectRef={bookSelectRef}
        onChange={changeFilters}
        onRetryBooks={retryBooks}
      />

      {list.status === 'loading' && <p className="muted">Loading…</p>}

      {list.status === 'error' && (
        <div className="stack">
          <p className="form-error" role="alert">
            Couldn't load your highlights.
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

      {list.status === 'ready' && list.items.length === 0 && !list.hasMore && (
        <EmptyState
          filtered={hasActiveFilters(filters)}
          onCapture={onCapture}
          onClear={clearFilters}
        />
      )}

      {list.status === 'ready' && (list.items.length > 0 || list.hasMore) && (
        <>
          <ul className="summary-list">
            {list.items.map((highlight) => (
              <li key={highlight.id}>
                <HighlightSummary highlight={highlight} />
              </li>
            ))}
          </ul>
          <p
            ref={countRef}
            tabIndex={-1}
            className="muted list-count"
            aria-live="polite"
          >
            Showing {loadedCountLabel(list.items.length)}
          </p>
          {list.more === 'error' && (
            <p className="form-error" role="alert">
              Couldn't load more.
            </p>
          )}
          {list.hasMore && (
            <button
              type="button"
              className="button button-secondary"
              aria-disabled={list.more === 'loading'}
              onClick={() => void loadMore()}
            >
              {list.more === 'loading' ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      )}
    </section>
  )
}

interface FiltersProps {
  filters: BrowseFilters
  books: BooksState
  bookSelectRef: RefObject<HTMLSelectElement | null>
  onChange: (next: BrowseFilters) => void
  onRetryBooks: () => void
}

function Filters({
  filters,
  books,
  bookSelectRef,
  onChange,
  onRetryBooks,
}: FiltersProps) {
  const bookId = useId()
  const codeId = useId()
  const colorName = useId()

  return (
    <div className="stack filters">
      <div className="field">
        <label htmlFor={bookId}>Book</label>
        <select
          ref={bookSelectRef}
          id={bookId}
          value={filters.bookId ?? ''}
          onChange={(event) =>
            onChange({ ...filters, bookId: event.target.value || null })
          }
        >
          <option value="">All books</option>
          {books.status === 'ready' &&
            books.books.map((book) => (
              <option key={book.id} value={book.id}>
                {bookFilterLabel(book)}
              </option>
            ))}
        </select>
        {books.status === 'error' && (
          <>
            <p className="form-error" role="alert">
              Couldn't load your books.
            </p>
            <button
              type="button"
              className="button button-secondary"
              onClick={onRetryBooks}
            >
              Try again
            </button>
          </>
        )}
      </div>

      <fieldset className="chip-group">
        <legend>Color</legend>
        <div className="chip-row">
          {[null, ...COLORS].map((color) => (
            <label key={color ?? 'all'} className="chip">
              <input
                type="radio"
                className="visually-hidden"
                name={colorName}
                checked={filters.color === color}
                onChange={() => onChange({ ...filters, color })}
              />
              {color && (
                <span className={`swatch swatch-${color}`} aria-hidden="true" />
              )}
              {colorFilterLabel(color)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor={codeId}>Code</label>
        <select
          id={codeId}
          value={filters.code ?? ''}
          onChange={(event) =>
            onChange({ ...filters, code: parseCode(event.target.value) })
          }
        >
          <option value="">All codes</option>
          {CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

interface EmptyStateProps {
  filtered: boolean
  onCapture: () => void
  onClear: () => void
}

function EmptyState({ filtered, onCapture, onClear }: EmptyStateProps) {
  return filtered ? (
    <div className="stack">
      <p className="empty">No highlights match these filters</p>
      <button type="button" className="button button-primary" onClick={onClear}>
        Clear filters
      </button>
    </div>
  ) : (
    <div className="stack">
      <p className="empty">No highlights yet</p>
      <button
        type="button"
        className="button button-primary"
        onClick={onCapture}
      >
        Capture a page
      </button>
    </div>
  )
}
