import { describe, expect, it } from 'vitest'
import { scorePage, type EvalHighlight } from './metrics.ts'
import {
  localDate,
  renderConsole,
  renderMarkdown,
  totalCounts,
  warningsFor,
  type PageResult,
  type RunInfo,
} from './report.ts'

// Fake text with an unmistakable marker, to prove it never reaches a report.
const SECRET = 'ZZ-COPYRIGHTED-SENTENCE-ZZ the lantern swung above the doorway'

function hl(text: string, extra: Partial<EvalHighlight> = {}): EvalHighlight {
  return { color: 'yellow', text, codes: [], symbols: [], ...extra }
}

const INFO: RunInfo = {
  date: '2026-11-05',
  models: ['claude-test'],
  promptVersions: ['extract-v3'],
  matchThreshold: 0.6,
  minPages: 2,
  devPagesSkipped: 1,
  unusablePages: [],
}

const RESULTS: PageResult[] = [
  {
    book: 'Fake Book',
    pageNumber: 10,
    counts: scorePage(
      [
        hl(SECRET, { color: 'pink', codes: ['H'] }),
        hl('an extra highlight here'),
      ],
      [hl(SECRET, { color: 'pink', codes: ['H'] })],
    ),
  },
  {
    book: 'Fake Book',
    pageNumber: 11,
    counts: scorePage(
      [hl(SECRET)],
      [hl(SECRET.replace('lantern', 'lamp'), { color: 'pink' })],
    ),
  },
]

describe('localDate', () => {
  it('formats the local calendar date with zero padding', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(localDate(new Date(2026, 10, 15, 0, 1))).toBe('2026-11-15')
  })
})

describe('totalCounts', () => {
  it('adds the pages together', () => {
    const total = totalCounts(RESULTS)
    expect(total.labelCount).toBe(2)
    expect(total.modelCount).toBe(3)
    expect(total.matched).toBe(2)
  })

  it('is all zeros for no pages', () => {
    expect(totalCounts([]).matched).toBe(0)
  })
})

describe('warningsFor', () => {
  it('is empty for a healthy run', () => {
    expect(warningsFor(INFO, RESULTS)).toEqual([])
  })

  it('warns when there are fewer pages than the minimum', () => {
    const warnings = warningsFor({ ...INFO, minPages: 15 }, RESULTS)
    expect(warnings).toEqual([
      'Only 2 eval pages found; the target is 15. Accuracy figures rest on few highlights.',
    ])
    expect(
      warningsFor({ ...INFO, minPages: 15 }, RESULTS.slice(0, 1))[0],
    ).toMatch(/Only 1 eval page found/)
  })

  it('warns when models or prompt versions are mixed', () => {
    expect(
      warningsFor(
        { ...INFO, promptVersions: ['extract-v2', 'extract-v3'] },
        RESULTS,
      ),
    ).toHaveLength(1)
    expect(warningsFor({ ...INFO, models: ['a', 'b'] }, RESULTS)[0]).toMatch(
      /more than one model or prompt version/,
    )
  })

  it('lists pages skipped for having no usable raw_extraction', () => {
    const warnings = warningsFor(
      { ...INFO, unusablePages: [{ book: 'Fake Book', pageNumber: 3 }] },
      RESULTS,
    )
    expect(warnings).toEqual([
      'Skipped 1 page with no usable raw_extraction: Fake Book p. 3.',
    ])
  })
})

describe('renderMarkdown', () => {
  const markdown = renderMarkdown(INFO, RESULTS)

  it('has the date, model, prompt version and counts', () => {
    expect(markdown).toContain('- Date: 2026-11-05')
    expect(markdown).toContain('- Model: claude-test')
    expect(markdown).toContain('- Prompt version: extract-v3')
    expect(markdown).toContain('- Book: Fake Book')
    expect(markdown).toContain(
      '- Pages evaluated: 2 (dev-set pages skipped: 1)',
    )
    expect(markdown).toContain(
      '- Highlights: 2 labeled, 3 from the model, 2 matched',
    )
  })

  it('has the overall metrics with counts', () => {
    // 2 matched of 3 model highlights and of 2 labels.
    expect(markdown).toContain(
      '| Highlight detection: precision | 66.7% | 2/3 |',
    )
    expect(markdown).toContain('| Highlight detection: recall | 100.0% | 2/2 |')
    expect(markdown).toContain('| Highlight detection: F1 | 80.0% |  |')
    // Page 11's color is wrong (yellow vs pink); page 10's is right.
    expect(markdown).toContain(
      '| Color accuracy (matched highlights) | 50.0% | 1/2 |',
    )
    expect(markdown).toContain(
      '| Text exact match (matched highlights) | 50.0% | 1/2 |',
    )
    expect(markdown).toContain(
      '| Codes and symbols: precision | 100.0% | 1/1 |',
    )
    expect(markdown).toContain('| Codes and symbols: recall | 100.0% | 1/1 |')
  })

  it('has one per-page row per page', () => {
    expect(markdown).toContain(
      '| Fake Book | 10 | 1 | 2 | 1 | 1/1 | 1/1 | 100.0% | 1/0/0 |',
    )
    expect(markdown).toMatch(
      /\| Fake Book \| 11 \| 1 \| 1 \| 1 \| 0\/1 \| 0\/1 \| \d+\.\d% \| 0\/0\/0 \|/,
    )
  })

  it('never contains highlight text', () => {
    expect(markdown).not.toContain('ZZ-COPYRIGHTED')
    expect(markdown).not.toContain('lantern')
    expect(markdown).not.toContain('extra highlight')
  })

  it('shows warnings as quoted lines at the top', () => {
    const warned = renderMarkdown({ ...INFO, minPages: 15 }, RESULTS)
    expect(warned).toContain('> **Warning:** Only 2 eval pages found')
    expect(markdown).not.toContain('**Warning:**')
  })

  it('states the match threshold used', () => {
    expect(renderMarkdown({ ...INFO, matchThreshold: 0.7 }, RESULTS)).toContain(
      'at least 0.7 similar',
    )
  })

  it('escapes pipes in a book title so the table stays intact', () => {
    const odd = renderMarkdown(INFO, [{ ...RESULTS[0], book: 'A | B' }])
    expect(odd).toContain('| A \\| B | 10 |')
  })

  it('shows n/a, not NaN, when nothing can be measured', () => {
    const empty = renderMarkdown(INFO, [
      { book: 'Fake Book', pageNumber: 1, counts: scorePage([], []) },
    ])
    expect(empty).not.toContain('NaN')
    expect(empty).toContain('| Highlight detection: precision | n/a | 0/0 |')
    expect(empty).toContain(
      '| Fake Book | 1 | 0 | 0 | 0 | n/a | n/a | n/a | 0/0/0 |',
    )
  })

  it('lists unknown when no model or prompt version was recorded', () => {
    const unknown = renderMarkdown(
      { ...INFO, models: [], promptVersions: [] },
      RESULTS,
    )
    expect(unknown).toContain('- Model: unknown')
    expect(unknown).toContain('- Prompt version: unknown')
  })
})

describe('renderConsole', () => {
  const text = renderConsole({ ...INFO, minPages: 15 }, RESULTS)

  it('summarizes the run, warnings, overall and per-page figures', () => {
    expect(text).toContain(
      'Eval 2026-11-05  model: claude-test  prompt: extract-v3',
    )
    expect(text).toContain('WARNING: Only 2 eval pages found')
    expect(text).toContain('Highlight detection: precision')
    expect(text).toContain('Fake Book p. 10: 1/2/1')
    expect(text).toContain('Fake Book p. 11: 1/1/1')
  })

  it('never contains highlight text', () => {
    expect(text).not.toContain('ZZ-COPYRIGHTED')
    expect(text).not.toContain('lantern')
  })
})
