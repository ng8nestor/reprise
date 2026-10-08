import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const tokensCss = readFileSync(
  new URL('../src/styles/tokens.css', import.meta.url),
  'utf8',
)

const MIN_RATIO = 4.5

function hexToken(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(
    tokensCss,
  )
  if (!match?.[1]) {
    throw new Error(`tokens.css has no 6-digit hex value for --${name}`)
  }
  return match[1]
}

function channelToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const r = channelToLinear(parseInt(hex.slice(1, 3), 16))
  const g = channelToLinear(parseInt(hex.slice(3, 5), 16))
  const b = channelToLinear(parseInt(hex.slice(5, 7), 16))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}

// [text token, background token]
const pairs: ReadonlyArray<readonly [string, string]> = [
  ['color-ink', 'color-bg'],
  ['color-ink', 'color-surface'],
  ['color-ink-muted', 'color-bg'],
  ['color-ink-muted', 'color-surface'],
  ['color-on-ink', 'color-ink'],
  ['color-ink', 'color-highlight-pink'],
  ['color-ink', 'color-highlight-yellow'],
  ['color-highlight-pink-ink', 'color-highlight-pink'],
  ['color-highlight-yellow-ink', 'color-highlight-yellow'],
  ['color-danger', 'color-surface'],
  ['color-danger', 'color-bg'],
]

describe('WCAG contrast (minimum 4.5:1)', () => {
  it.each(
    pairs.map(([fg, bg]) => {
      const ratio = contrastRatio(hexToken(fg), hexToken(bg))
      return {
        name: `${fg} on ${bg}: ${ratio.toFixed(2)}:1`,
        ratio,
      }
    }),
  )('$name', ({ ratio }) => {
    expect(ratio).toBeGreaterThanOrEqual(MIN_RATIO)
  })
})
