import type { Database, Json } from '../../shared/database.types.ts'
import type { ExtractResponse } from './extractClient.ts'
import type { DraftHighlight } from './review.ts'

// Pure pieces of saving a reviewed page; savePage.ts does the I/O.

export type SavePageArgs = Database['public']['Functions']['save_page']['Args']

export const PHOTO_BUCKET = 'page-photos'

// Matches the Storage policies: the first folder must be the owner's id.
export function photoPath(userId: string, pageId: string): string {
  return `${userId}/${pageId}.jpg`
}

// Keys of the highlights that would be saved with no text. Whitespace
// counts as empty, the same rule as the database's highlights_text_not_blank.
export function blankHighlightKeys(
  highlights: readonly DraftHighlight[],
): string[] {
  return highlights
    .filter((highlight) => highlight.text.trim() === '')
    .map((highlight) => highlight.key)
}

// "Highlight 2 is empty." / "Highlights 2 and 4 are empty." /
// "Highlights 1, 3 and 4 are empty."
export function blankHighlightsMessage(positions: readonly number[]): string {
  const sorted = [...positions].sort((a, b) => a - b)
  if (sorted.length === 1) {
    return `Highlight ${sorted[0]} is empty. Add its text or delete it.`
  }
  const list = `${sorted.slice(0, -1).join(', ')} and ${sorted.at(-1)}`
  return `Highlights ${list} are empty. Add their text or delete them.`
}

// The highlights as save_page expects them. Text is trimmed here, not while
// typing, so editing never fights the cursor.
export function toSavedHighlights(highlights: readonly DraftHighlight[]): Json {
  return highlights.map((highlight) => ({
    position: highlight.position,
    color: highlight.color,
    text: highlight.text.trim(),
    codes: highlight.codes,
    symbols: highlight.symbols,
  }))
}

// What the model returned, kept in pages.raw_extraction to compare with my
// edits later: the validated highlights and warnings, plus the reply text
// exactly as sent, so it can be re-parsed if the parser changes.
// prompt_version has its own column.
export function rawExtraction(extraction: ExtractResponse): Json {
  return {
    model: extraction.model,
    highlights: extraction.highlights,
    warnings: extraction.warnings,
    raw: extraction.raw,
  }
}

export interface SavePageInput {
  pageId: string
  userId: string
  bookId: string
  pageNumber: number
  extraction: ExtractResponse
  highlights: readonly DraftHighlight[]
  dueOn: string
}

export function savePageArgs(input: SavePageInput): SavePageArgs {
  return {
    page_id: input.pageId,
    book_id: input.bookId,
    page_number: input.pageNumber,
    photo_path: photoPath(input.userId, input.pageId),
    raw_extraction: rawExtraction(input.extraction),
    prompt_version: input.extraction.promptVersion,
    due_on: input.dueOn,
    highlights: toSavedHighlights(input.highlights),
  }
}

// Label of the save button, so the count is on it before I tap.
export function saveButtonLabel(count: number): string {
  if (count === 0) return 'Save page'
  return count === 1 ? 'Save 1 highlight' : `Save ${count} highlights`
}

// Heading of the screen after saving.
export function savedHeading(count: number): string {
  if (count === 0) return 'Page saved'
  return count === 1 ? 'Saved 1 highlight' : `Saved ${count} highlights`
}
