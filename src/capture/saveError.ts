import { SERVER_UNREACHABLE } from '../auth/signInError.ts'

// How saving a page failed, as far as the browser can tell.
// - network: no response at all (offline, timeout). The save may or may not
//   have reached the database.
// - database: the database (or PostgREST in front of it) answered with an
//   error code, so nothing was written.
// - other: anything else (an unexpected reply, no session).
export type SaveFailure =
  { kind: 'network' } | { kind: 'database'; code: string } | { kind: 'other' }

export const COULD_NOT_SAVE = "Couldn't save. Try again."

// Postgres error codes (SQLSTATE).
const UNIQUE_VIOLATION = '23505'

export function alreadyCapturedMessage(pageNumber: number): string {
  return `You've already captured page ${pageNumber} of this book.`
}

export function saveErrorMessage(
  failure: SaveFailure,
  pageNumber: number,
): string {
  if (failure.kind === 'network') return SERVER_UNREACHABLE
  // The only unique key a fresh save can hit is (book_id, page_number):
  // the page id is new, and positions are renumbered 1..n before saving.
  if (failure.kind === 'database' && failure.code === UNIQUE_VIOLATION) {
    return alreadyCapturedMessage(pageNumber)
  }
  // 23503 (the book is gone or isn't mine) lands here too.
  return COULD_NOT_SAVE
}

// The parts of a supabase.rpc() result that say how it failed. supabase-js
// reports a fetch that got no response as status 0 with an empty code.
export interface RpcErrorInfo {
  status: number
  code: string
}

export function rpcFailure({ status, code }: RpcErrorInfo): SaveFailure {
  if (status === 0) return { kind: 'network' }
  if (code !== '') return { kind: 'database', code }
  return { kind: 'other' }
}

// supabase-js reports an upload that got no response as a
// StorageUnknownError, and an HTTP error reply as a StorageApiError.
// Checked by name: storage-js isn't a direct dependency to import from.
export function uploadFailure(error: unknown): SaveFailure {
  const isNetwork =
    error instanceof Error && error.name === 'StorageUnknownError'
  return isNetwork ? { kind: 'network' } : { kind: 'other' }
}

// Whether the photo just uploaded can be deleted after a failed save. Only
// when the database definitely refused: after a network failure the page
// may have been saved anyway, and deleting its photo would leave the page
// pointing at nothing. A rare orphan file is the safer mistake.
export function shouldDeletePhoto(failure: SaveFailure): boolean {
  return failure.kind === 'database'
}
