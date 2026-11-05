import {
  EMPTY_COUNTS,
  addCounts,
  summarize,
  type Counts,
  type Rate,
} from './metrics.ts'
import type { PageRef } from './pages.ts'

// Renders eval results as Markdown (eval/RESULTS.md) and as console text.
//
// Everything here works from counts and book/page references. There is no
// highlight text in any input type, so none can end up in the output: the
// results file is committed to a public repo and the text is copyrighted.

export interface PageResult extends PageRef {
  counts: Counts
}

export interface RunInfo {
  // YYYY-MM-DD, see localDate.
  date: string
  // Distinct values found on the evaluated pages. More than one means the
  // pages were extracted under different settings.
  models: string[]
  promptVersions: string[]
  matchThreshold: number
  // Warn when fewer eval pages than this are found.
  minPages: number
  // Pages in the eval book that were kept out as dev-set pages.
  devPagesSkipped: number
  // Eval-book pages left out because raw_extraction was missing or unreadable.
  unusablePages: PageRef[]
}

// Local calendar date as YYYY-MM-DD (not UTC, which can be tomorrow's date in
// the evening in California).
export function localDate(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function percent(value: number | null): string {
  return value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`
}

function fraction(rate: Rate): string {
  return `${rate.hits}/${rate.total}`
}

function list(values: readonly string[]): string {
  return values.length === 0 ? 'unknown' : values.join(', ')
}

function pageLabel(ref: PageRef): string {
  return `${ref.book} p. ${ref.pageNumber}`
}

export function totalCounts(results: readonly PageResult[]): Counts {
  return results.reduce((sum, r) => addCounts(sum, r.counts), EMPTY_COUNTS)
}

// Problems worth showing at the top of both outputs.
export function warningsFor(
  info: RunInfo,
  results: readonly PageResult[],
): string[] {
  const warnings: string[] = []
  if (results.length < info.minPages) {
    warnings.push(
      `Only ${results.length} eval page${results.length === 1 ? '' : 's'} found; the target is ${info.minPages}. Accuracy figures rest on few highlights.`,
    )
  }
  if (info.models.length > 1 || info.promptVersions.length > 1) {
    warnings.push(
      'Eval pages were extracted with more than one model or prompt version, so the figures mix them.',
    )
  }
  if (info.unusablePages.length > 0) {
    warnings.push(
      `Skipped ${info.unusablePages.length} page${info.unusablePages.length === 1 ? '' : 's'} with no usable raw_extraction: ${info.unusablePages.map(pageLabel).join('; ')}.`,
    )
  }
  return warnings
}

interface OverallRow {
  metric: string
  value: string
  // How many items the value is out of, e.g. "28/30".
  count: string
}

function overallRows(counts: Counts): OverallRow[] {
  const s = summarize(counts)
  return [
    {
      metric: 'Highlight detection: precision',
      value: percent(s.detection.precision.value),
      count: fraction(s.detection.precision),
    },
    {
      metric: 'Highlight detection: recall',
      value: percent(s.detection.recall.value),
      count: fraction(s.detection.recall),
    },
    {
      metric: 'Highlight detection: F1',
      value: percent(s.detection.f1.value),
      count: '',
    },
    {
      metric: 'Color accuracy (matched highlights)',
      value: percent(s.colorAccuracy.value),
      count: fraction(s.colorAccuracy),
    },
    {
      metric: 'Text exact match (matched highlights)',
      value: percent(s.textExact.value),
      count: fraction(s.textExact),
    },
    {
      metric: 'Text mean character similarity (matched highlights)',
      value: percent(s.textSimilarity),
      count: `over ${counts.matched}`,
    },
    {
      metric: 'Codes and symbols: precision',
      value: percent(s.marks.precision.value),
      count: fraction(s.marks.precision),
    },
    {
      metric: 'Codes and symbols: recall',
      value: percent(s.marks.recall.value),
      count: fraction(s.marks.recall),
    },
  ]
}

interface PageRow {
  page: string
  labels: number
  model: number
  matched: number
  color: string
  exact: string
  similarity: string
  marks: string
}

function pageRow(result: PageResult): PageRow {
  const s = summarize(result.counts)
  return {
    page: String(result.pageNumber),
    labels: result.counts.labelCount,
    model: result.counts.modelCount,
    matched: result.counts.matched,
    color: result.counts.matched === 0 ? 'n/a' : fraction(s.colorAccuracy),
    exact: result.counts.matched === 0 ? 'n/a' : fraction(s.textExact),
    similarity: percent(s.textSimilarity),
    marks: `${result.counts.markTp}/${result.counts.markFp}/${result.counts.markFn}`,
  }
}

function escapeCell(text: string): string {
  return text.replaceAll('|', '\\|')
}

export function renderMarkdown(
  info: RunInfo,
  results: readonly PageResult[],
): string {
  const total = totalCounts(results)
  const books = [...new Set(results.map((r) => r.book))]
  const lines: string[] = [
    '# Eval results',
    '',
    'Generated by `npm run eval`. Do not edit by hand. Counts and page references only; no book text.',
    '',
    `- Date: ${info.date}`,
    `- Model: ${list(info.models)}`,
    `- Prompt version: ${list(info.promptVersions)}`,
    `- Book: ${list(books)}`,
    `- Pages evaluated: ${results.length} (dev-set pages skipped: ${info.devPagesSkipped})`,
    `- Highlights: ${total.labelCount} labeled, ${total.modelCount} from the model, ${total.matched} matched`,
    '',
  ]

  const warnings = warningsFor(info, results)
  if (warnings.length > 0) {
    lines.push(...warnings.map((w) => `> **Warning:** ${w}`), '')
  }

  lines.push(
    '## Overall',
    '',
    '| Metric | Value | Count |',
    '| --- | --- | --- |',
    ...overallRows(total).map(
      (r) => `| ${r.metric} | ${r.value} | ${r.count} |`,
    ),
    '',
    '## Per page',
    '',
    'Marks are true positives / false positives / false negatives for codes and symbols on matched highlights.',
    '',
    '| Book | Page | Labeled | Model | Matched | Color | Exact text | Text similarity | Marks TP/FP/FN |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...results.map((r) => {
      const row = pageRow(r)
      return `| ${escapeCell(r.book)} | ${row.page} | ${row.labels} | ${row.model} | ${row.matched} | ${row.color} | ${row.exact} | ${row.similarity} | ${row.marks} |`
    }),
    '',
    '## Method',
    '',
    '- Ground truth: the highlights I corrected during review (`highlights` table), under the labeling guideline in `eval/KILL_TEST.md`. Model output: `pages.raw_extraction`.',
    `- A model highlight and a label are the same highlight when their normalized text is at least ${info.matchThreshold} similar (1 minus edit distance over the longer length). Each highlight is matched at most once, best pairs first.`,
    '- Normalization: Unicode NFKC, quote and dash styles unified, whitespace collapsed. Case, punctuation and line-break hyphens are not changed.',
    '- Detection: precision, recall and F1 over highlights. Color, text and marks are scored on matched highlights only.',
    '- Overall figures pool every highlight; they are not averages of the per-page figures.',
    '',
  )

  return lines.join('\n')
}

export function renderConsole(
  info: RunInfo,
  results: readonly PageResult[],
): string {
  const total = totalCounts(results)
  const lines: string[] = [
    `Eval ${info.date}  model: ${list(info.models)}  prompt: ${list(info.promptVersions)}`,
    `${results.length} pages (${info.devPagesSkipped} dev-set pages skipped), ` +
      `${total.labelCount} labeled / ${total.modelCount} model highlights, ${total.matched} matched`,
  ]

  for (const warning of warningsFor(info, results)) {
    lines.push(`WARNING: ${warning}`)
  }

  lines.push('', 'Overall')
  const rows = overallRows(total)
  const width = Math.max(...rows.map((r) => r.metric.length))
  for (const r of rows) {
    lines.push(
      `  ${r.metric.padEnd(width)}  ${r.value.padStart(6)}  ${r.count}`,
    )
  }

  lines.push(
    '',
    'Per page  (labeled/model/matched, color, exact text, similarity, marks TP/FP/FN)',
  )
  for (const r of results) {
    const row = pageRow(r)
    lines.push(
      `  ${pageLabel(r)}: ${row.labels}/${row.model}/${row.matched}  color ${row.color}  exact ${row.exact}  sim ${row.similarity}  marks ${row.marks}`,
    )
  }

  return lines.join('\n')
}
