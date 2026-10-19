import type { BookKind, Color } from '../../shared/vocabulary.ts'

// What a highlight color means depends on the kind of book. The label is
// always written next to the tint, so color never carries meaning alone.
const LABELS: Record<BookKind, Record<Color, string>> = {
  nonfiction: { pink: 'Claim', yellow: 'Evidence' },
  biography: { pink: 'Their words', yellow: 'Turning point' },
}

export function highlightLabel(kind: BookKind, color: Color): string {
  return LABELS[kind][color]
}
