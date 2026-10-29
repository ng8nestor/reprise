import { describe, expect, it } from 'vitest'
import type { ExtractResponse } from './extractClient.ts'
import type { DraftHighlight } from './review.ts'
import {
  blankHighlightKeys,
  blankHighlightsMessage,
  photoPath,
  saveButtonLabel,
  savedHeading,
  savePageArgs,
  toSavedHighlights,
} from './save.ts'

function draft(
  position: number,
  overrides: Partial<DraftHighlight> = {},
): DraftHighlight {
  return {
    key: `h${position}`,
    position,
    color: 'pink',
    text: `Highlight ${position}`,
    codes: [],
    symbols: [],
    ...overrides,
  }
}

const extraction: ExtractResponse = {
  highlights: [
    {
      position: 1,
      color: 'pink',
      text: 'Model text',
      codes: ['H'],
      symbols: [],
    },
  ],
  warnings: ['Margin cut off'],
  raw: '{"highlights": []}',
  promptVersion: 'extract-v3',
  model: 'claude-test',
}

describe('photoPath', () => {
  it('puts the photo in the owner folder, named by page id', () => {
    expect(photoPath('user-1', 'page-1')).toBe('user-1/page-1.jpg')
  })
})

describe('blankHighlightKeys', () => {
  it('finds empty and whitespace-only highlights', () => {
    const highlights = [
      draft(1),
      draft(2, { text: '' }),
      draft(3, { text: '  \n\t ' }),
      draft(4, { text: ' kept ' }),
    ]
    expect(blankHighlightKeys(highlights)).toEqual(['h2', 'h3'])
  })

  it('returns nothing when every highlight has text', () => {
    expect(blankHighlightKeys([draft(1), draft(2)])).toEqual([])
  })
})

describe('blankHighlightsMessage', () => {
  it('names a single highlight', () => {
    expect(blankHighlightsMessage([2])).toBe(
      'Highlight 2 is empty. Add its text or delete it.',
    )
  })

  it('names two highlights in order', () => {
    expect(blankHighlightsMessage([4, 2])).toBe(
      'Highlights 2 and 4 are empty. Add their text or delete them.',
    )
  })

  it('names three or more highlights', () => {
    expect(blankHighlightsMessage([1, 3, 4])).toBe(
      'Highlights 1, 3 and 4 are empty. Add their text or delete them.',
    )
  })
})

describe('toSavedHighlights', () => {
  it('trims text and drops the React key', () => {
    expect(
      toSavedHighlights([
        draft(1, { text: '  A claim.\n', codes: ['H', 'L'], symbols: ['try'] }),
      ]),
    ).toEqual([
      {
        position: 1,
        color: 'pink',
        text: 'A claim.',
        codes: ['H', 'L'],
        symbols: ['try'],
      },
    ])
  })
})

describe('savePageArgs', () => {
  it('builds the save_page arguments', () => {
    const args = savePageArgs({
      pageId: 'page-1',
      userId: 'user-1',
      bookId: 'book-1',
      pageNumber: 12,
      extraction,
      highlights: [draft(1, { color: 'yellow', text: 'Edited ' })],
      dueOn: '2026-10-28',
    })
    expect(args).toEqual({
      page_id: 'page-1',
      book_id: 'book-1',
      page_number: 12,
      photo_path: 'user-1/page-1.jpg',
      raw_extraction: {
        model: 'claude-test',
        highlights: extraction.highlights,
        warnings: ['Margin cut off'],
        raw: '{"highlights": []}',
      },
      prompt_version: 'extract-v3',
      due_on: '2026-10-28',
      highlights: [
        {
          position: 1,
          color: 'yellow',
          text: 'Edited',
          codes: [],
          symbols: [],
        },
      ],
    })
  })
})

describe('saveButtonLabel', () => {
  it.each([
    [0, 'Save page'],
    [1, 'Save 1 highlight'],
    [2, 'Save 2 highlights'],
    [12, 'Save 12 highlights'],
  ])('%i → %s', (count, label) => {
    expect(saveButtonLabel(count)).toBe(label)
  })
})

describe('savedHeading', () => {
  it.each([
    [0, 'Page saved'],
    [1, 'Saved 1 highlight'],
    [2, 'Saved 2 highlights'],
    [12, 'Saved 12 highlights'],
  ])('%i → %s', (count, heading) => {
    expect(savedHeading(count)).toBe(heading)
  })
})
