import { describe, expect, it } from 'vitest'
import {
  parseDevSet,
  parsePageRow,
  selectEvalPages,
  type PageRef,
} from './pages.ts'

// Fake rows only: no real book text.
function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    page_number: 12,
    prompt_version: 'extract-v3',
    book: { title: 'Fake Book' },
    raw_extraction: {
      model: 'claude-test',
      warnings: [],
      raw: '{}',
      highlights: [
        { position: 1, color: 'pink', text: 'model one', codes: ['H'] },
        {
          position: 2,
          color: 'yellow',
          text: 'model two',
          codes: [],
          symbols: ['doubt'],
        },
      ],
    },
    highlights: [
      {
        position: 2,
        color: 'yellow',
        text: 'label two',
        codes: [],
        symbols: [],
      },
      {
        position: 1,
        color: 'pink',
        text: 'label one',
        codes: ['H'],
        symbols: [],
      },
    ],
    ...overrides,
  }
}

describe('parsePageRow', () => {
  it('reads the model output and the corrected labels', () => {
    const loaded = parsePageRow(row())
    if (!loaded.ok) throw new Error('expected ok')
    // Usable pages carry the reference too, so they can be selected.
    expect(loaded).toMatchObject({ book: 'Fake Book', pageNumber: 12 })
    expect(loaded.page).toMatchObject({
      book: 'Fake Book',
      pageNumber: 12,
      promptVersion: 'extract-v3',
      model: 'claude-test',
    })
    expect(loaded.page.predicted).toEqual([
      { color: 'pink', text: 'model one', codes: ['H'], symbols: [] },
      {
        color: 'yellow',
        text: 'model two',
        codes: [],
        symbols: ['doubt'],
      },
    ])
  })

  it('orders the labels by position', () => {
    const loaded = parsePageRow(row())
    if (!loaded.ok) throw new Error('expected ok')
    expect(loaded.page.labels.map((h) => h.text)).toEqual([
      'label one',
      'label two',
    ])
  })

  it('accepts a page saved with no highlights at all', () => {
    const loaded = parsePageRow(
      row({ raw_extraction: { highlights: [] }, highlights: [] }),
    )
    if (!loaded.ok) throw new Error('expected ok')
    expect(loaded.page.predicted).toEqual([])
    expect(loaded.page.labels).toEqual([])
    expect(loaded.page.model).toBeNull()
  })

  it('marks a page with null raw_extraction as unusable, keeping its reference', () => {
    expect(parsePageRow(row({ raw_extraction: null }))).toEqual({
      ok: false,
      book: 'Fake Book',
      pageNumber: 12,
    })
  })

  it('marks a page with malformed raw_extraction as unusable', () => {
    expect(
      parsePageRow(row({ raw_extraction: { highlights: 'nope' } })).ok,
    ).toBe(false)
  })

  it('throws when the row itself has the wrong shape', () => {
    expect(() => parsePageRow(row({ book: null }))).toThrow(
      /did not have the expected shape/,
    )
    expect(() => parsePageRow('nope')).toThrow(/expected shape/)
  })
})

describe('parseDevSet', () => {
  it('reads a list of book and page entries', () => {
    expect(
      parseDevSet([
        { book: 'Fake Book', page: 48 },
        { book: 'Other', page: 3 },
      ]),
    ).toEqual([
      { book: 'Fake Book', page: 48 },
      { book: 'Other', page: 3 },
    ])
  })

  it('refuses an entry whose page number is not filled in', () => {
    expect(() =>
      parseDevSet([
        { book: 'Fake Book', page: 48 },
        { book: 'Napoleon', page: null },
      ]),
    ).toThrow(/no page number yet for: Napoleon/)
  })

  it('refuses entries of the wrong shape', () => {
    expect(() => parseDevSet({ book: 'x', page: 1 })).toThrow(/not a list/)
    expect(() => parseDevSet([{ book: 'x', page: 0 }])).toThrow(/not a list/)
    expect(() => parseDevSet([{ book: '', page: 1 }])).toThrow(/not a list/)
    expect(() => parseDevSet([{ book: 'x', page: 1.5 }])).toThrow(/not a list/)
  })

  it('accepts an empty list', () => {
    expect(parseDevSet([])).toEqual([])
  })
})

describe('selectEvalPages', () => {
  const page = (book: string, pageNumber: number): PageRef => ({
    book,
    pageNumber,
  })
  const options = {
    bookTitle: 'Fake Book',
    devSet: [
      { book: 'Fake Book', page: 7 },
      { book: 'Other', page: 48 },
    ],
  }

  it('keeps pages of the eval book that are not in the dev set, by page number', () => {
    const { evalPages } = selectEvalPages(
      [page('Fake Book', 30), page('Fake Book', 2), page('Fake Book', 7)],
      options,
    )
    expect(evalPages).toEqual([page('Fake Book', 2), page('Fake Book', 30)])
  })

  it('reports dev pages of the eval book as skipped', () => {
    const { skippedDev } = selectEvalPages(
      [page('Fake Book', 7), page('Fake Book', 8)],
      options,
    )
    expect(skippedDev).toEqual([page('Fake Book', 7)])
  })

  it('leaves out other books entirely, dev page or not', () => {
    const { evalPages, otherBooks } = selectEvalPages(
      [page('Other', 48), page('Other', 49), page('Fake Book', 1)],
      options,
    )
    expect(evalPages).toEqual([page('Fake Book', 1)])
    expect(otherBooks).toEqual([page('Other', 48), page('Other', 49)])
  })

  it('matches titles ignoring case and extra spaces', () => {
    const { evalPages, skippedDev } = selectEvalPages(
      [page('  fake   BOOK ', 7), page('FAKE book', 9)],
      options,
    )
    expect(skippedDev).toEqual([page('  fake   BOOK ', 7)])
    expect(evalPages).toEqual([page('FAKE book', 9)])
  })

  it('does not treat a different page number as the dev page', () => {
    const { evalPages } = selectEvalPages([page('Fake Book', 70)], options)
    expect(evalPages).toEqual([page('Fake Book', 70)])
  })

  it('lists dev-set entries that match no saved page', () => {
    const { unmatchedDevEntries } = selectEvalPages(
      [page('Fake Book', 7)],
      options,
    )
    expect(unmatchedDevEntries).toEqual([{ book: 'Other', page: 48 }])
  })

  it('keeps extra fields on the pages it returns', () => {
    const rich = { ...page('Fake Book', 1), extra: 'kept' }
    expect(selectEvalPages([rich], options).evalPages[0]).toBe(rich)
  })

  it('handles no pages', () => {
    expect(selectEvalPages([], options)).toEqual({
      evalPages: [],
      skippedDev: [],
      otherBooks: [],
      unmatchedDevEntries: options.devSet,
    })
  })
})
