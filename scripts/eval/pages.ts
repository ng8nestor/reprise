import { z } from 'zod'
import type { EvalHighlight } from './metrics.ts'

// Turns database rows into pages ready to score, and picks which pages
// belong in the eval. Pure: the script does the querying.

// ---------------------------------------------------------------------------
// Rows from the database
// ---------------------------------------------------------------------------

// The shape of one `pages` row with its book and corrected highlights, as
// selected in scripts/eval-saved.ts. Checked rather than cast, so a schema
// change fails loudly here instead of producing wrong numbers.
const LabelSchema = z.object({
  position: z.number().int(),
  color: z.string(),
  text: z.string(),
  codes: z.array(z.string()),
  symbols: z.array(z.string()),
})

const PageRowSchema = z.object({
  page_number: z.number().int(),
  prompt_version: z.string().nullable(),
  raw_extraction: z.unknown(),
  book: z.object({ title: z.string() }),
  highlights: z.array(LabelSchema),
})

// What save.ts stores in pages.raw_extraction (src/capture/save.ts). Only the
// fields the eval needs; unknown keys such as `raw` are ignored.
const RawExtractionSchema = z.object({
  model: z.string().optional(),
  highlights: z.array(
    z.object({
      color: z.string(),
      text: z.string(),
      codes: z.array(z.string()).default([]),
      symbols: z.array(z.string()).default([]),
    }),
  ),
})

export interface PageRef {
  book: string
  pageNumber: number
}

export interface EvalPage extends PageRef {
  promptVersion: string | null
  // From raw_extraction.model; null if the row didn't record one.
  model: string | null
  // What the model returned (raw_extraction.highlights).
  predicted: EvalHighlight[]
  // My corrected highlights (the highlights table), in page order.
  labels: EvalHighlight[]
}

// Both variants carry the page's book and number, so pages can be selected
// before anyone checks whether they are usable.
export type LoadedPage =
  | ({ ok: true; page: EvalPage } & PageRef)
  // The row was readable but raw_extraction was null or not in the expected
  // shape, so the model's output can't be scored for this page.
  | ({ ok: false } & PageRef)

// Throws if the row itself has the wrong shape (a bug or schema change).
// Returns ok:false for a page with no usable raw_extraction (for example one
// saved before raw_extraction existed), which the eval skips with a warning.
export function parsePageRow(row: unknown): LoadedPage {
  const parsed = PageRowSchema.safeParse(row)
  if (!parsed.success) {
    throw new Error(
      `A pages row did not have the expected shape:\n${z.prettifyError(parsed.error)}`,
    )
  }
  const { page_number, prompt_version, raw_extraction, book, highlights } =
    parsed.data
  const ref: PageRef = { book: book.title, pageNumber: page_number }

  const raw = RawExtractionSchema.safeParse(raw_extraction)
  if (!raw.success) return { ok: false, ...ref }

  return {
    ok: true,
    ...ref,
    page: {
      ...ref,
      promptVersion: prompt_version,
      model: raw.data.model ?? null,
      predicted: raw.data.highlights,
      labels: [...highlights]
        .sort((a, b) => a.position - b.position)
        .map(({ color, text, codes, symbols }) => ({
          color,
          text,
          codes,
          symbols,
        })),
    },
  }
}

// ---------------------------------------------------------------------------
// Which pages are in the eval
// ---------------------------------------------------------------------------

// A page used while tuning the prompt. Tuned-on pages can't be part of the
// reported accuracy.
export interface DevSetEntry {
  book: string
  page: number
}

const DevSetSchema = z.array(
  z.object({
    book: z.string().min(1),
    // null means "not filled in yet"; parseDevSet refuses to continue.
    page: z.number().int().positive().nullable(),
  }),
)

// Reads eval/dev-set.json. An entry with page null is an unfinished list, and
// running anyway would leave a tuned-on page in the "unseen" eval, so it
// throws instead.
export function parseDevSet(json: unknown): DevSetEntry[] {
  const parsed = DevSetSchema.safeParse(json)
  if (!parsed.success) {
    throw new Error(
      `eval/dev-set.json is not a list of { "book", "page" } entries:\n${z.prettifyError(parsed.error)}`,
    )
  }
  const unfinished = parsed.data.filter((entry) => entry.page === null)
  if (unfinished.length > 0) {
    const names = unfinished.map((entry) => entry.book).join(', ')
    throw new Error(
      `eval/dev-set.json has no page number yet for: ${names}. ` +
        'Fill it in so that page is kept out of the eval.',
    )
  }
  return parsed.data.flatMap((entry) =>
    entry.page === null ? [] : [{ book: entry.book, page: entry.page }],
  )
}

// Titles match ignoring case and extra spaces.
function titleKey(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase()
}

export interface Selection<T extends PageRef> {
  // Pages to score, by page number.
  evalPages: T[]
  // Pages of the eval book left out because they are in the dev set.
  skippedDev: T[]
  // Pages of other books, left out because they aren't in the eval set.
  otherBooks: T[]
  // Dev-set entries that match no saved page. Often a typo in the title.
  unmatchedDevEntries: DevSetEntry[]
}

export function selectEvalPages<T extends PageRef>(
  pages: readonly T[],
  options: { bookTitle: string; devSet: readonly DevSetEntry[] },
): Selection<T> {
  const isDevPage = (entry: DevSetEntry, page: PageRef): boolean =>
    titleKey(entry.book) === titleKey(page.book) &&
    entry.page === page.pageNumber

  const evalPages: T[] = []
  const skippedDev: T[] = []
  const otherBooks: T[] = []
  for (const page of pages) {
    if (titleKey(page.book) !== titleKey(options.bookTitle)) {
      otherBooks.push(page)
    } else if (options.devSet.some((entry) => isDevPage(entry, page))) {
      skippedDev.push(page)
    } else {
      evalPages.push(page)
    }
  }
  evalPages.sort((a, b) => a.pageNumber - b.pageNumber)

  return {
    evalPages,
    skippedDev,
    otherBooks,
    unmatchedDevEntries: options.devSet.filter(
      (entry) => !pages.some((page) => isDevPage(entry, page)),
    ),
  }
}
