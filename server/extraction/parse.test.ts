import { describe, expect, it } from 'vitest'
import { parseExtraction } from './parse.ts'

const valid = {
  highlights: [
    {
      position: 1,
      color: 'pink',
      text: 'The control group showed no change.',
      codes: ['RCT', 'n='],
      symbols: ['doubt'],
    },
    {
      position: 2,
      color: 'yellow',
      text: 'Habits form faster than expected.',
      codes: [],
      symbols: [],
    },
  ],
  warnings: ['Margin note near line 12 is smudged'],
}

function withHighlight(overrides: Record<string, unknown>): string {
  return JSON.stringify({
    highlights: [{ ...valid.highlights[0], ...overrides }],
    warnings: [],
  })
}

describe('parseExtraction', () => {
  it('accepts valid JSON', () => {
    const result = parseExtraction(JSON.stringify(valid))
    expect(result).toEqual({ ok: true, data: valid })
  })

  it('accepts JSON wrapped in ``` fences', () => {
    const raw = '```json\n' + JSON.stringify(valid, null, 2) + '\n```'
    expect(parseExtraction(raw)).toEqual({ ok: true, data: valid })
  })

  it('accepts JSON with extra text around it', () => {
    const raw = `Here are the highlights:\n${JSON.stringify(valid)}\nLet me know!`
    expect(parseExtraction(raw)).toEqual({ ok: true, data: valid })
  })

  it('rejects invalid JSON', () => {
    const result = parseExtraction('{"highlights": [ { "position": 1, }')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('invalid_json')
  })

  it('rejects a reply with no JSON at all', () => {
    const result = parseExtraction('I could not find any highlights.')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('no_json')
  })

  it('rejects an unknown color', () => {
    const result = parseExtraction(withHighlight({ color: 'orange' }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('schema')
      expect(result.error.message).toContain('color')
    }
  })

  it('rejects an unknown code', () => {
    const result = parseExtraction(withHighlight({ codes: ['RCT', 'n=40'] }))
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.kind).toBe('schema')
      expect(result.error.message).toContain('codes')
    }
  })

  it('accepts an empty highlights list', () => {
    const result = parseExtraction('{"highlights": [], "warnings": []}')
    expect(result).toEqual({ ok: true, data: { highlights: [], warnings: [] } })
  })

  it('joins line-break hyphenation in highlight text', () => {
    const result = parseExtraction(
      withHighlight({ text: 'a cap- able reader' }),
    )
    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.data.highlights[0].text).toBe('a capable reader')
  })

  it('defaults missing codes, symbols, and warnings to empty lists', () => {
    const raw = JSON.stringify({
      highlights: [{ position: 1, color: 'yellow', text: 'Some words' }],
    })
    expect(parseExtraction(raw)).toEqual({
      ok: true,
      data: {
        highlights: [
          {
            position: 1,
            color: 'yellow',
            text: 'Some words',
            codes: [],
            symbols: [],
          },
        ],
        warnings: [],
      },
    })
  })
})
