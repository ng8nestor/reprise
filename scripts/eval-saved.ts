// Accuracy eval from saved pages. Run with `npm run eval` (reads .env).
//
// Every saved page keeps what the model returned (pages.raw_extraction) and
// the highlights I corrected during review (the highlights table). The
// corrected highlights are the ground truth, so scoring needs no new model
// calls: this script only reads from the database.
//
// It signs in as me with the publishable key, so Row Level Security applies
// exactly as in the app. It never uses a service-role key.
//
// Writes eval/RESULTS.md (numbers and book/page references only, never
// highlight text) and prints a summary.

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Database } from '../shared/database.types.ts'
import { readEvalEnv } from './eval/env.ts'
import { MATCH_THRESHOLD, scorePage } from './eval/metrics.ts'
import {
  parseDevSet,
  parsePageRow,
  selectEvalPages,
  type EvalPage,
} from './eval/pages.ts'
import {
  localDate,
  renderConsole,
  renderMarkdown,
  type PageResult,
  type RunInfo,
} from './eval/report.ts'

const ROOT = path.resolve(import.meta.dirname, '..')
const DEV_SET_PATH = path.join(ROOT, 'eval', 'dev-set.json')
const RESULTS_PATH = path.join(ROOT, 'eval', 'RESULTS.md')

// The eval set (DECISIONS.md): Napoleon pages, unseen while tuning the prompt.
const EVAL_BOOK_TITLE = 'Napoleon: A Life'
const MIN_EVAL_PAGES = 15

// One request: each page with its book title and its corrected highlights.
// "!inner" leaves out a page whose book can't be read instead of returning
// it with a null book (same idea as src/browse/browse.ts).
const PAGE_COLUMNS =
  'page_number, prompt_version, raw_extraction, book:books!inner(title), highlights(position, color, text, codes, symbols)'

function distinct(values: readonly (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => v !== null))].sort()
}

async function main(): Promise<void> {
  // Check the local settings first so a mistake fails before any network call.
  const env = readEvalEnv(process.env)
  const devSet = parseDevSet(JSON.parse(await readFile(DEV_SET_PATH, 'utf8')))

  const supabase = createClient<Database>(env.url, env.publishableKey, {
    // A one-off script: no stored session, no refresh timer.
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const signedIn = await supabase.auth.signInWithPassword({
    email: env.email,
    password: env.password,
  })
  if (signedIn.error) {
    throw new Error(`Sign-in failed: ${signedIn.error.message}`)
  }

  const { data, error } = await supabase
    .from('pages')
    .select(PAGE_COLUMNS)
    .order('page_number')
  if (error) throw new Error(`Could not load pages: ${error.message}`)

  const loaded = data.map(parsePageRow)
  const selection = selectEvalPages(loaded, {
    bookTitle: EVAL_BOOK_TITLE,
    devSet,
  })

  for (const entry of selection.unmatchedDevEntries) {
    console.warn(
      `Note: dev-set entry "${entry.book}" p. ${entry.page} matches no saved page (check the book title spelling).`,
    )
  }

  if (selection.evalPages.length === 0) {
    const titles = distinct(loaded.map((l) => l.book))
    console.error(
      `No eval pages found for "${EVAL_BOOK_TITLE}" (${loaded.length} saved pages in total).`,
    )
    console.error(
      `Book titles on your saved pages: ${titles.length > 0 ? titles.join('; ') : '(none)'}`,
    )
    process.exitCode = 1
    return
  }

  const usable: EvalPage[] = []
  const unusablePages = []
  for (const entry of selection.evalPages) {
    if (entry.ok) usable.push(entry.page)
    else unusablePages.push({ book: entry.book, pageNumber: entry.pageNumber })
  }

  const results: PageResult[] = usable.map((page) => ({
    book: page.book,
    pageNumber: page.pageNumber,
    counts: scorePage(page.predicted, page.labels, MATCH_THRESHOLD),
  }))

  const info: RunInfo = {
    date: localDate(new Date()),
    models: distinct(usable.map((p) => p.model)),
    promptVersions: distinct(usable.map((p) => p.promptVersion)),
    matchThreshold: MATCH_THRESHOLD,
    minPages: MIN_EVAL_PAGES,
    devPagesSkipped: selection.skippedDev.length,
    unusablePages,
  }

  if (results.length === 0) {
    console.error(
      `None of the ${selection.evalPages.length} "${EVAL_BOOK_TITLE}" pages has a usable raw_extraction, so there is nothing to score.`,
    )
    process.exitCode = 1
    return
  }

  console.log(renderConsole(info, results))
  await writeFile(RESULTS_PATH, renderMarkdown(info, results))
  console.log(`\nWrote ${path.relative(ROOT, RESULTS_PATH)}`)
}

try {
  await main()
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exitCode = 1
}
