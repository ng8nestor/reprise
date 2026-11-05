import { describe, expect, it } from 'vitest'
import {
  EMPTY_COUNTS,
  MATCH_THRESHOLD,
  addCounts,
  matchHighlights,
  normalizeText,
  rate,
  scorePage,
  similarity,
  summarize,
  type Counts,
  type EvalHighlight,
} from './metrics.ts'

// Made-up sentences only. Real highlight text never goes in tests.
const LANTERN =
  'A small lantern swung from the hook above the doorway, casting long shadows across the yard.'
const TREATY =
  'He insisted that the treaty be signed before the harvest, though few of his advisers agreed.'
const RIVER =
  'Most of the army crossed the river at dawn, leaving the baggage and the wounded behind them.'
const ENGINE =
  'The new engine was lighter and faster than anything the factory had produced for the railway.'

function hl(text: string, extra: Partial<EvalHighlight> = {}): EvalHighlight {
  return { color: 'yellow', text, codes: [], symbols: [], ...extra }
}

describe('normalizeText', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeText('  a \n b\t\tc  ')).toBe('a b c')
  })

  it('treats curly and straight quotes as the same', () => {
    expect(normalizeText('“It’s”')).toBe('"It\'s"')
  })

  it('treats dash variants as the same', () => {
    expect(normalizeText('1805–1815 — war')).toBe('1805-1815 - war')
  })

  it('applies Unicode compatibility forms (ellipsis, non-breaking space)', () => {
    expect(normalizeText('wait… now')).toBe('wait... now')
  })

  it('removes soft hyphens', () => {
    expect(normalizeText('con­tinue')).toBe('continue')
  })

  it('keeps case and punctuation', () => {
    expect(normalizeText('The End.')).not.toBe(normalizeText('the end'))
  })

  it('does not join a line-break hyphen (that is the app normalizer’s job)', () => {
    expect(normalizeText('cap- able')).toBe('cap- able')
  })
})

describe('similarity', () => {
  it('is 1 for identical text, even if only formatting differs', () => {
    expect(similarity(LANTERN, LANTERN)).toBe(1)
    expect(similarity('It’s  here', "It's here")).toBe(1)
  })

  it('is 1 for two empty texts and 0 for empty against non-empty', () => {
    expect(similarity('', '  ')).toBe(1)
    expect(similarity('', 'abc')).toBe(0)
  })

  it('is 1 - distance / longer length', () => {
    // kitten -> sitting is 3 edits over 7 characters.
    expect(similarity('kitten', 'sitting')).toBeCloseTo(1 - 3 / 7, 10)
  })

  it('counts an accented or emoji character as one character', () => {
    expect(similarity('café', 'cafe')).toBeCloseTo(0.75, 10)
    expect(similarity('a😀b', 'a😁b')).toBeCloseTo(2 / 3, 10)
  })

  it('is symmetric', () => {
    expect(similarity(LANTERN, RIVER)).toBeCloseTo(
      similarity(RIVER, LANTERN),
      10,
    )
  })
})

describe('MATCH_THRESHOLD', () => {
  it('sits well above unrelated text and well below a small slip', () => {
    const unrelated = [
      similarity(LANTERN, TREATY),
      similarity(LANTERN, RIVER),
      similarity(TREATY, ENGINE),
      similarity(RIVER, ENGINE),
    ]
    for (const score of unrelated) expect(score).toBeLessThan(0.4)

    const oneWordWrong = similarity(RIVER, RIVER.replace('baggage', 'luggage'))
    expect(oneWordWrong).toBeGreaterThan(0.9)

    expect(MATCH_THRESHOLD).toBeGreaterThan(Math.max(...unrelated))
    expect(MATCH_THRESHOLD).toBeLessThan(oneWordWrong)
  })

  it('rejects a highlight cut to half and accepts one with 80% kept', () => {
    expect(similarity(RIVER, RIVER.slice(0, 46))).toBeLessThan(MATCH_THRESHOLD)
    expect(similarity(RIVER, RIVER.slice(0, 74))).toBeGreaterThanOrEqual(
      MATCH_THRESHOLD,
    )
  })
})

describe('matchHighlights', () => {
  it('pairs identical highlights regardless of order', () => {
    const model = [hl(TREATY), hl(LANTERN)]
    const labels = [hl(LANTERN), hl(TREATY)]
    const { matches, unmatchedModel, unmatchedLabels } = matchHighlights(
      model,
      labels,
    )
    expect(matches).toEqual([
      { modelIndex: 0, labelIndex: 1, similarity: 1, exact: true },
      { modelIndex: 1, labelIndex: 0, similarity: 1, exact: true },
    ])
    expect(unmatchedModel).toEqual([])
    expect(unmatchedLabels).toEqual([])
  })

  it('matches a highlight with a small text slip and flags it inexact', () => {
    const { matches } = matchHighlights(
      [hl(RIVER.replace('baggage', 'luggage'))],
      [hl(RIVER)],
    )
    expect(matches).toHaveLength(1)
    expect(matches[0].exact).toBe(false)
    expect(matches[0].similarity).toBeGreaterThan(0.9)
  })

  it('never pairs one highlight twice: the best pair wins', () => {
    // Both model highlights resemble the single label; the closer one wins
    // and the other is left over as an extra.
    const close = hl(RIVER)
    const farther = hl(RIVER.slice(0, 74))
    const { matches, unmatchedModel } = matchHighlights(
      [farther, close],
      [hl(RIVER)],
    )
    expect(matches).toHaveLength(1)
    expect(matches[0].modelIndex).toBe(1)
    expect(unmatchedModel).toEqual([0])
  })

  it('reports unrelated highlights as unmatched on both sides', () => {
    const { matches, unmatchedModel, unmatchedLabels } = matchHighlights(
      [hl(LANTERN)],
      [hl(ENGINE)],
    )
    expect(matches).toEqual([])
    expect(unmatchedModel).toEqual([0])
    expect(unmatchedLabels).toEqual([0])
  })

  it('treats a similarity exactly at the threshold as a match', () => {
    // 5 of 10 characters kept: similarity is exactly 0.5.
    const a = hl('abcdefghij')
    const b = hl('abcdeXXXXX')
    expect(matchHighlights([a], [b], 0.5).matches).toHaveLength(1)
    expect(matchHighlights([a], [b], 0.51).matches).toHaveLength(0)
  })

  it('is deterministic when two pairs tie', () => {
    const same = hl(LANTERN)
    const { matches } = matchHighlights([same, same], [same, same])
    expect(matches.map((m) => [m.modelIndex, m.labelIndex])).toEqual([
      [0, 0],
      [1, 1],
    ])
  })

  it('handles empty inputs', () => {
    expect(matchHighlights([], [])).toEqual({
      matches: [],
      unmatchedModel: [],
      unmatchedLabels: [],
    })
    expect(matchHighlights([hl(LANTERN)], []).unmatchedModel).toEqual([0])
    expect(matchHighlights([], [hl(LANTERN)]).unmatchedLabels).toEqual([0])
  })
})

describe('scorePage', () => {
  it('scores a perfect page', () => {
    const labels = [
      hl(LANTERN, { color: 'pink', codes: ['H'], symbols: ['doubt'] }),
      hl(TREATY),
    ]
    expect(scorePage(labels, labels)).toEqual({
      labelCount: 2,
      modelCount: 2,
      matched: 2,
      colorCorrect: 2,
      textExact: 2,
      similaritySum: 2,
      markTp: 2,
      markFp: 0,
      markFn: 0,
    })
  })

  it('counts a missed highlight and an extra one separately', () => {
    const counts = scorePage(
      [hl(LANTERN), hl(ENGINE)],
      [hl(LANTERN), hl(TREATY)],
    )
    expect(counts.matched).toBe(1)
    expect(counts.modelCount - counts.matched).toBe(1) // extra
    expect(counts.labelCount - counts.matched).toBe(1) // missed
  })

  it('judges color on matched pairs only', () => {
    const counts = scorePage(
      [hl(LANTERN, { color: 'pink' }), hl(ENGINE, { color: 'pink' })],
      [hl(LANTERN, { color: 'yellow' })],
    )
    expect(counts.matched).toBe(1)
    expect(counts.colorCorrect).toBe(0)
  })

  it('does not count formatting-only differences as text errors', () => {
    const counts = scorePage(
      [hl('It’s   here, the end.')],
      [hl("It's here, the end.")],
    )
    expect(counts.textExact).toBe(1)
    expect(counts.similaritySum).toBe(1)
  })

  it('records inexact text and its similarity', () => {
    const slipped = RIVER.replace('baggage', 'luggage')
    const counts = scorePage([hl(slipped)], [hl(RIVER)])
    expect(counts.textExact).toBe(0)
    expect(counts.similaritySum).toBeCloseTo(similarity(slipped, RIVER), 10)
  })

  it('does not hide a hyphen the app left unjoined', () => {
    const counts = scorePage(
      [hl('a cap- able leader')],
      [hl('a capable leader')],
    )
    expect(counts.matched).toBe(1)
    expect(counts.textExact).toBe(0)
  })

  it('scores marks as (highlight, mark) pairs', () => {
    const counts = scorePage(
      [hl(LANTERN, { codes: ['H', 'RCT'], symbols: ['doubt'] })],
      [hl(LANTERN, { codes: ['H', 'A'], symbols: ['doubt'] })],
    )
    // H and doubt agree; RCT is extra; A is missed.
    expect(counts.markTp).toBe(2)
    expect(counts.markFp).toBe(1)
    expect(counts.markFn).toBe(1)
  })

  it('penalizes a mark attached to the neighbouring highlight twice', () => {
    // The code belongs to the first highlight but the model put it on the second.
    const counts = scorePage(
      [hl(LANTERN), hl(TREATY, { codes: ['C'] })],
      [hl(LANTERN, { codes: ['C'] }), hl(TREATY)],
    )
    expect(counts.matched).toBe(2)
    expect(counts.markTp).toBe(0)
    expect(counts.markFp).toBe(1)
    expect(counts.markFn).toBe(1)
  })

  it('keeps a code and a symbol with the same spelling apart', () => {
    const counts = scorePage(
      [hl(LANTERN, { codes: ['M'] })],
      [hl(LANTERN, { symbols: ['M'] })],
    )
    expect(counts.markTp).toBe(0)
    expect(counts.markFp).toBe(1)
    expect(counts.markFn).toBe(1)
  })

  it('collapses duplicate marks on one highlight', () => {
    const counts = scorePage(
      [hl(LANTERN, { codes: ['H', 'H'] })],
      [hl(LANTERN, { codes: ['H'] })],
    )
    expect(counts.markTp).toBe(1)
    expect(counts.markFp).toBe(0)
  })

  it('ignores marks on highlights that were not matched', () => {
    const counts = scorePage(
      [hl(ENGINE, { codes: ['H'] })],
      [hl(TREATY, { codes: ['A'] })],
    )
    expect(counts.matched).toBe(0)
    expect(counts.markTp + counts.markFp + counts.markFn).toBe(0)
  })

  it('handles a page with nothing on it', () => {
    expect(scorePage([], [])).toEqual(EMPTY_COUNTS)
  })

  it('handles a page where the model found nothing', () => {
    const counts = scorePage([], [hl(LANTERN)])
    expect(counts).toEqual({ ...EMPTY_COUNTS, labelCount: 1 })
  })
})

describe('addCounts', () => {
  it('adds every field', () => {
    const a: Counts = {
      labelCount: 1,
      modelCount: 2,
      matched: 3,
      colorCorrect: 4,
      textExact: 5,
      similaritySum: 0.5,
      markTp: 6,
      markFp: 7,
      markFn: 8,
    }
    expect(addCounts(a, a)).toEqual({
      labelCount: 2,
      modelCount: 4,
      matched: 6,
      colorCorrect: 8,
      textExact: 10,
      similaritySum: 1,
      markTp: 12,
      markFp: 14,
      markFn: 16,
    })
  })

  it('treats EMPTY_COUNTS as zero', () => {
    const counts = scorePage([hl(LANTERN)], [hl(LANTERN)])
    expect(addCounts(EMPTY_COUNTS, counts)).toEqual(counts)
  })
})

describe('rate', () => {
  it('divides, and gives null instead of NaN for an empty total', () => {
    expect(rate(1, 4)).toEqual({ hits: 1, total: 4, value: 0.25 })
    expect(rate(0, 0)).toEqual({ hits: 0, total: 0, value: null })
  })
})

describe('summarize', () => {
  it('computes precision, recall and F1 from the counts', () => {
    // 8 matched, 2 extra, 4 missed.
    const summary = summarize({
      ...EMPTY_COUNTS,
      labelCount: 12,
      modelCount: 10,
      matched: 8,
    })
    expect(summary.detection.precision.value).toBeCloseTo(8 / 10, 10)
    expect(summary.detection.recall.value).toBeCloseTo(8 / 12, 10)
    const p = 8 / 10
    const r = 8 / 12
    expect(summary.detection.f1.value).toBeCloseTo((2 * p * r) / (p + r), 10)
  })

  it('computes field accuracy and mean similarity over matched pairs', () => {
    const summary = summarize({
      ...EMPTY_COUNTS,
      labelCount: 5,
      modelCount: 5,
      matched: 4,
      colorCorrect: 3,
      textExact: 2,
      similaritySum: 3.6,
    })
    expect(summary.colorAccuracy).toEqual({ hits: 3, total: 4, value: 0.75 })
    expect(summary.textExact).toEqual({ hits: 2, total: 4, value: 0.5 })
    expect(summary.textSimilarity).toBeCloseTo(0.9, 10)
  })

  it('computes mark precision and recall', () => {
    const summary = summarize({
      ...EMPTY_COUNTS,
      markTp: 6,
      markFp: 2,
      markFn: 3,
    })
    expect(summary.marks.precision.value).toBeCloseTo(6 / 8, 10)
    expect(summary.marks.recall.value).toBeCloseTo(6 / 9, 10)
  })

  it('reports null, not NaN, when there is nothing to measure', () => {
    const summary = summarize(EMPTY_COUNTS)
    expect(summary.detection.precision.value).toBeNull()
    expect(summary.detection.recall.value).toBeNull()
    expect(summary.detection.f1.value).toBeNull()
    expect(summary.colorAccuracy.value).toBeNull()
    expect(summary.textExact.value).toBeNull()
    expect(summary.textSimilarity).toBeNull()
    expect(summary.marks.precision.value).toBeNull()
    expect(summary.marks.recall.value).toBeNull()
  })

  it('has undefined precision and zero recall when the model found nothing', () => {
    // Labels exist but the model returned none: nothing to be precise about,
    // recall and F1 are 0.
    const summary = summarize({ ...EMPTY_COUNTS, labelCount: 3 })
    expect(summary.detection.precision.value).toBeNull()
    expect(summary.detection.recall.value).toBe(0)
    expect(summary.detection.f1.value).toBe(0)
  })

  it('pools counts across pages rather than averaging page rates', () => {
    // Page A: 1 of 1 right. Page B: 1 of 9 right. Pooled 2/10, not mean(1, 1/9).
    const pageA = scorePage([hl(LANTERN)], [hl(LANTERN)])
    const pageB: Counts = {
      ...EMPTY_COUNTS,
      labelCount: 9,
      modelCount: 9,
      matched: 1,
    }
    const pooled = summarize(addCounts(pageA, pageB))
    expect(pooled.detection.precision.value).toBeCloseTo(2 / 10, 10)
  })
})
