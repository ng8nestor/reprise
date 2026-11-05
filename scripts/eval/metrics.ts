// Pure scoring for `npm run eval`: compares the model's highlights on one
// page (pages.raw_extraction) with my corrected highlights (the highlights
// table), which count as ground truth under the labeling guideline in
// eval/KILL_TEST.md. No I/O here, so every rule below is unit tested.
//
// Nothing in this file's OUTPUT contains highlight text, only counts. That is
// deliberate: results are committed to a public repo and the text is
// copyrighted book text.

export interface EvalHighlight {
  color: string
  text: string
  codes: readonly string[]
  symbols: readonly string[]
}

// ---------------------------------------------------------------------------
// Text normalization and similarity
// ---------------------------------------------------------------------------

const SINGLE_QUOTES = /[‘’‚‛′]/g
const DOUBLE_QUOTES = /[“”„‟″]/g
// Hyphen, non-breaking hyphen, figure/en/em dashes, horizontal bar, minus.
const DASHES = /[‐-―−]/g
const SOFT_HYPHEN = /­/g

// Removes differences that don't change what I'd read or review: Unicode
// form (NFKC also turns "…" into "..."), quote style, dash style, soft
// hyphens, and runs of whitespace. Case and punctuation are kept, since a
// wrong letter or comma is a real transcription error.
//
// Line-break hyphens ("cap- able") are NOT joined here. The app already
// joins them after parsing (server/extraction/normalize.ts), so one that
// survives into the saved text is a miss I'd have had to fix by hand.
export function normalizeText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(SOFT_HYPHEN, '')
    .replace(SINGLE_QUOTES, "'")
    .replace(DOUBLE_QUOTES, '"')
    .replace(DASHES, '-')
    .replace(/\s+/g, ' ')
    .trim()
}

// Edit distance over code points (so an emoji or accented letter counts as
// one character, not two UTF-16 units). Two-row dynamic programming.
function editDistance(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(
        previous[j] + 1, // delete
        current[j - 1] + 1, // insert
        previous[j - 1] + cost, // substitute
      )
    }
    previous = current
  }
  return previous[b.length]
}

// 1 - editDistance / longer length, over already-normalized code points.
// 1 means identical, 0 means nothing in common. Two empty texts are identical.
function charSimilarity(a: readonly string[], b: readonly string[]): number {
  const longer = Math.max(a.length, b.length)
  if (longer === 0) return 1
  return 1 - editDistance(a, b) / longer
}

// Character-level similarity of two texts after normalization, 0 to 1.
export function similarity(a: string, b: string): number {
  return charSimilarity(
    Array.from(normalizeText(a)),
    Array.from(normalizeText(b)),
  )
}

// ---------------------------------------------------------------------------
// Matching model highlights to labels
// ---------------------------------------------------------------------------

// A model highlight and a label are "the same highlight" when their
// normalized texts are at least this similar. Why 0.6:
// - Unrelated English sentences of similar length score about 0.2 to 0.3
//   under this measure (letters line up by chance), so 0.6 is far above
//   chance. The test file checks this on sample sentences.
// - A real extraction slip (a wrong word, a dropped hyphen, a typo) leaves
//   a highlight at 0.9 or better, far above the line.
// - A highlight cut to half its length scores about 0.5 and one with 80%
//   kept about 0.8. Below 0.6 the model got less than about 60% of it
//   right (cut at a line break, merged across a gap); I'd rewrite it by
//   hand, so it counts as a miss plus an extra, not as a match with bad text.
// Raising it makes detection stricter and moves partial highlights out of the
// "text similarity" figure into misses; lowering it does the reverse.
// Known limit: two different very short highlights ("the army" / "the navy",
// 0.63) can match each other. Rare on one page; it would turn a miss plus an
// extra into one match with low text similarity.
export const MATCH_THRESHOLD = 0.6

export interface Match {
  modelIndex: number
  labelIndex: number
  similarity: number
  // Normalized texts are identical.
  exact: boolean
}

export interface Matching {
  matches: Match[]
  unmatchedModel: number[]
  unmatchedLabels: number[]
}

// One-to-one matching: every candidate pair at or above the threshold is
// ranked by similarity, and the best pairs are taken first. A highlight is
// never matched twice. Position is ignored (detection is about which
// highlights were found, not their order). Ties break by index so results
// are deterministic.
export function matchHighlights(
  model: readonly EvalHighlight[],
  labels: readonly EvalHighlight[],
  threshold: number = MATCH_THRESHOLD,
): Matching {
  const modelChars = model.map((h) => Array.from(normalizeText(h.text)))
  const labelChars = labels.map((h) => Array.from(normalizeText(h.text)))

  const candidates: Match[] = []
  for (let i = 0; i < model.length; i++) {
    for (let j = 0; j < labels.length; j++) {
      const a = modelChars[i]
      const b = labelChars[j]
      const longer = Math.max(a.length, b.length)
      // Similarity can't exceed shorter / longer, so skip the expensive
      // comparison when the lengths alone rule the pair out.
      if (longer > 0 && Math.min(a.length, b.length) / longer < threshold) {
        continue
      }
      const score = charSimilarity(a, b)
      if (score >= threshold) {
        candidates.push({
          modelIndex: i,
          labelIndex: j,
          similarity: score,
          exact: score === 1,
        })
      }
    }
  }
  candidates.sort(
    (x, y) =>
      y.similarity - x.similarity ||
      x.modelIndex - y.modelIndex ||
      x.labelIndex - y.labelIndex,
  )

  const takenModel = new Set<number>()
  const takenLabels = new Set<number>()
  const matches: Match[] = []
  for (const candidate of candidates) {
    if (takenModel.has(candidate.modelIndex)) continue
    if (takenLabels.has(candidate.labelIndex)) continue
    takenModel.add(candidate.modelIndex)
    takenLabels.add(candidate.labelIndex)
    matches.push(candidate)
  }
  matches.sort((x, y) => x.modelIndex - y.modelIndex)

  return {
    matches,
    unmatchedModel: model.flatMap((_, i) => (takenModel.has(i) ? [] : [i])),
    unmatchedLabels: labels.flatMap((_, j) => (takenLabels.has(j) ? [] : [j])),
  }
}

// ---------------------------------------------------------------------------
// Counts: what one page (or many pages added together) contributes
// ---------------------------------------------------------------------------

// Plain counts that can be added across pages. Rates are derived from the
// summed counts (see summarize), so overall figures pool every highlight
// instead of averaging per-page percentages.
export interface Counts {
  // Highlights in the corrected labels / in the model's output.
  labelCount: number
  modelCount: number
  // Model highlights paired with a label. Also the true positives.
  matched: number
  // Among matched pairs:
  colorCorrect: number
  textExact: number
  // Sum of per-pair character similarity (divide by matched for the mean).
  similaritySum: number
  // (highlight, mark) pairs among matched pairs. A mark is one code or one
  // symbol on one highlight.
  markTp: number
  markFp: number
  markFn: number
}

export const EMPTY_COUNTS: Counts = {
  labelCount: 0,
  modelCount: 0,
  matched: 0,
  colorCorrect: 0,
  textExact: 0,
  similaritySum: 0,
  markTp: 0,
  markFp: 0,
  markFn: 0,
}

export function addCounts(a: Counts, b: Counts): Counts {
  return {
    labelCount: a.labelCount + b.labelCount,
    modelCount: a.modelCount + b.modelCount,
    matched: a.matched + b.matched,
    colorCorrect: a.colorCorrect + b.colorCorrect,
    textExact: a.textExact + b.textExact,
    similaritySum: a.similaritySum + b.similaritySum,
    markTp: a.markTp + b.markTp,
    markFp: a.markFp + b.markFp,
    markFn: a.markFn + b.markFn,
  }
}

// Codes and symbols share one namespace of marks. The prefix keeps a code and
// a symbol with the same spelling apart.
function marksOf(highlight: EvalHighlight): Set<string> {
  return new Set([
    ...highlight.codes.map((code) => `code:${code}`),
    ...highlight.symbols.map((symbol) => `symbol:${symbol}`),
  ])
}

// Scores one page. Color, text and marks are judged on matched pairs only, so
// each field's accuracy is not dragged down by highlights that were missed or
// invented (detection already counts those). Marks on an unmatched highlight
// are therefore not counted at all; they are a detection problem first.
export function scorePage(
  model: readonly EvalHighlight[],
  labels: readonly EvalHighlight[],
  threshold: number = MATCH_THRESHOLD,
): Counts {
  const { matches } = matchHighlights(model, labels, threshold)

  let colorCorrect = 0
  let textExact = 0
  let similaritySum = 0
  let markTp = 0
  let markFp = 0
  let markFn = 0

  for (const match of matches) {
    const predicted = model[match.modelIndex]
    const truth = labels[match.labelIndex]

    if (predicted.color === truth.color) colorCorrect++
    if (match.exact) textExact++
    similaritySum += match.similarity

    const predictedMarks = marksOf(predicted)
    const truthMarks = marksOf(truth)
    for (const mark of predictedMarks) {
      if (truthMarks.has(mark)) markTp++
      else markFp++
    }
    for (const mark of truthMarks) {
      if (!predictedMarks.has(mark)) markFn++
    }
  }

  return {
    labelCount: labels.length,
    modelCount: model.length,
    matched: matches.length,
    colorCorrect,
    textExact,
    similaritySum,
    markTp,
    markFp,
    markFn,
  }
}

// ---------------------------------------------------------------------------
// Rates
// ---------------------------------------------------------------------------

// hits / total, with the raw counts kept for display. value is null when
// there is nothing to measure (total 0), never NaN, so a report can say "n/a"
// instead of a misleading 0% or 100%.
export interface Rate {
  hits: number
  total: number
  value: number | null
}

export function rate(hits: number, total: number): Rate {
  return { hits, total, value: total === 0 ? null : hits / total }
}

export interface PrecisionRecall {
  precision: Rate
  recall: Rate
  // F1 = 2TP / (2TP + FP + FN), the same number as the harmonic mean of
  // precision and recall but defined whenever there is anything to count.
  f1: Rate
}

function precisionRecall(tp: number, fp: number, fn: number): PrecisionRecall {
  return {
    precision: rate(tp, tp + fp),
    recall: rate(tp, tp + fn),
    f1: rate(2 * tp, 2 * tp + fp + fn),
  }
}

export interface Summary {
  detection: PrecisionRecall
  // Of matched pairs, how many have the right color / identical text.
  colorAccuracy: Rate
  textExact: Rate
  // Mean character similarity over matched pairs, 0 to 1; null if none.
  textSimilarity: number | null
  // Over (highlight, mark) pairs on matched highlights.
  marks: PrecisionRecall
}

export function summarize(counts: Counts): Summary {
  const falsePositives = counts.modelCount - counts.matched
  const falseNegatives = counts.labelCount - counts.matched
  return {
    detection: precisionRecall(counts.matched, falsePositives, falseNegatives),
    colorAccuracy: rate(counts.colorCorrect, counts.matched),
    textExact: rate(counts.textExact, counts.matched),
    textSimilarity:
      counts.matched === 0 ? null : counts.similaritySum / counts.matched,
    marks: precisionRecall(counts.markTp, counts.markFp, counts.markFn),
  }
}
