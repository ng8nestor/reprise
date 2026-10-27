import { describe, expect, it } from 'vitest'
import { highlightLabel } from './highlightLabel.ts'

describe('highlightLabel', () => {
  it.each([
    ['nonfiction', 'pink', 'Claim'],
    ['nonfiction', 'yellow', 'Evidence'],
    ['biography', 'pink', 'Their words'],
    ['biography', 'yellow', 'Turning point'],
  ] as const)('%s + %s is "%s"', (kind, color, label) => {
    expect(highlightLabel(kind, color)).toBe(label)
  })
})
