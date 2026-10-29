import {
  toHighlightSummaries,
  type HighlightSummaryData,
} from '../highlights/highlightSummary.ts'
import { supabase } from '../lib/supabase.ts'
import { buildFilterClauses, type BrowseFilters } from './browseFilters.ts'
import { pageRange, splitPage, type HighlightPage } from './browsePage.ts'

// "!inner" leaves out a highlight whose page or book can't be read, instead
// of returning it with a null page (same as queue.ts). It also lets the
// query filter on the page's book_id, which isn't selected.
const BROWSE_COLUMNS =
  'id, text, color, codes, symbols, page:pages!inner(page_number, book:books!inner(title, kind))'

// One page of my highlights that match every filter set, newest page first.
// The filters run in the database, not here. Highlights saved together share
// created_at (one transaction in save_page), so created_at orders by page;
// page_id then position keep each page's highlights together in page order
// and make the order total, so offsets never skip or repeat a row.
export async function fetchHighlightPage(
  filters: BrowseFilters,
  offset: number,
): Promise<HighlightPage<HighlightSummaryData>> {
  let query = supabase.from('highlights').select(BROWSE_COLUMNS)
  for (const clause of buildFilterClauses(filters)) {
    query =
      clause.kind === 'equals'
        ? query.eq(clause.column, clause.value)
        : query.contains(clause.column, clause.values)
  }
  const { from, to } = pageRange(offset)
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('page_id', { ascending: true })
    .order('position', { ascending: true })
    .range(from, to)
  if (error) throw error
  const { rows, hasMore } = splitPage(data)
  return { rows: toHighlightSummaries(rows), hasMore }
}
