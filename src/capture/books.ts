import type { Tables } from '../../shared/database.types.ts'
import { BOOK_KINDS, type BookKind } from '../../shared/vocabulary.ts'
import { supabase } from '../lib/supabase.ts'

export interface Book {
  id: string
  title: string
  author: string | null
  kind: BookKind
}

export interface NewBook {
  title: string
  author: string | null
  kind: BookKind
}

const BOOK_COLUMNS = 'id, title, author, kind'

type BookRow = Pick<Tables<'books'>, 'id' | 'title' | 'author' | 'kind'>

function isBookKind(value: string): value is BookKind {
  return BOOK_KINDS.some((kind) => kind === value)
}

// The generated types say kind is any string; the database's check
// constraint says it's one of BOOK_KINDS. Rows that disagree are skipped
// rather than shown with a made-up label.
function toBook(row: BookRow): Book | null {
  if (!isBookKind(row.kind)) return null
  return { id: row.id, title: row.title, author: row.author, kind: row.kind }
}

// Newest first: the book I'm reading now is most likely the one I added last.
export async function fetchBooks(): Promise<Book[]> {
  const { data, error } = await supabase
    .from('books')
    .select(BOOK_COLUMNS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data.flatMap((row) => {
    const book = toBook(row)
    return book ? [book] : []
  })
}

// user_id is filled in by the database (default auth.uid()), and RLS only
// accepts it if it's mine.
export async function addBook(newBook: NewBook): Promise<Book> {
  const { data, error } = await supabase
    .from('books')
    .insert(newBook)
    .select(BOOK_COLUMNS)
    .single()
  if (error) throw error
  const book = toBook(data)
  if (!book) throw new Error(`Unexpected book kind: ${data.kind}`)
  return book
}
