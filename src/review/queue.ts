import { localDateString } from '../capture/dueDate.ts'
import { rpcFailure, type SaveFailure } from '../capture/saveError.ts'
import { supabase } from '../lib/supabase.ts'
import { REVIEW_LIMIT, toReviewCards, type ReviewCard } from './reviewCard.ts'
import { nextSchedule, type Grade, type Schedule } from './scheduler.ts'

// "!inner" leaves out a highlight whose page or book can't be read, instead
// of returning it with a null page. The foreign keys make that impossible
// today; this keeps a gap from showing up as a blank card.
const REVIEW_COLUMNS =
  'id, text, color, codes, symbols, box, page:pages!inner(page_number, book:books!inner(title, kind))'

// Today's review: highlights due on or before the phone's local date,
// oldest due date first, then lowest box, at most REVIEW_LIMIT. The last
// two orderings only make the order stable: highlights saved together
// (same created_at) come out in page order.
export async function fetchReviewQueue(now: Date): Promise<ReviewCard[]> {
  const { data, error } = await supabase
    .from('highlights')
    .select(REVIEW_COLUMNS)
    .lte('due_on', localDateString(now))
    .order('due_on', { ascending: true })
    .order('box', { ascending: true })
    .order('created_at', { ascending: true })
    .order('position', { ascending: true })
    .limit(REVIEW_LIMIT)
  if (error) throw error
  return toReviewCards(data)
}

// Moves the highlight to its next box and due date. Resolves to null once
// saved, or to why it failed; never throws.
export async function saveGrade(
  card: ReviewCard,
  grade: Grade,
  now: Date,
): Promise<SaveFailure | null> {
  const next: Schedule = nextSchedule(card.box, grade, now)
  try {
    const { data, error, status } = await supabase
      .from('highlights')
      .update({ box: next.box, due_on: next.dueOn })
      .eq('id', card.id)
      .select('id')
    if (error) return rpcFailure({ status, code: error.code })
    // .select() returns the updated rows. RLS turns an update of a row I
    // can't see into "0 rows updated" with no error, so that's a failure.
    return data.length === 1 ? null : { kind: 'other' }
  } catch {
    return { kind: 'other' }
  }
}
