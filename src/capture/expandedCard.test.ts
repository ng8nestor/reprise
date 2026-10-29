import { describe, expect, it } from 'vitest'
import { keyAfterDelete, nextExpanded } from './expandedCard.ts'

describe('nextExpanded', () => {
  describe('open', () => {
    it('opens a card when all are collapsed', () => {
      expect(nextExpanded(null, { type: 'open', key: 'h2' })).toBe('h2')
    })

    it('closes the open card when another one opens', () => {
      expect(nextExpanded('h1', { type: 'open', key: 'h3' })).toBe('h3')
    })

    it('keeps the same card open when it is opened again', () => {
      expect(nextExpanded('h2', { type: 'open', key: 'h2' })).toBe('h2')
    })
  })

  describe('close', () => {
    it('collapses the open card', () => {
      expect(nextExpanded('h2', { type: 'close', key: 'h2' })).toBeNull()
    })

    it('ignores closing a card that is not the open one', () => {
      expect(nextExpanded('h2', { type: 'close', key: 'h1' })).toBe('h2')
    })

    it('does nothing when every card is already collapsed', () => {
      expect(nextExpanded(null, { type: 'close', key: 'h1' })).toBeNull()
    })
  })

  describe('add', () => {
    it('opens the new card when all are collapsed', () => {
      expect(nextExpanded(null, { type: 'add', key: 'h7' })).toBe('h7')
    })

    it('closes the open card in favor of the new one', () => {
      expect(nextExpanded('h2', { type: 'add', key: 'h7' })).toBe('h7')
    })
  })

  describe('delete', () => {
    it('collapses everything when the open card is deleted', () => {
      expect(nextExpanded('h2', { type: 'delete', key: 'h2' })).toBeNull()
    })

    it('keeps the open card when a different one is deleted', () => {
      expect(nextExpanded('h2', { type: 'delete', key: 'h4' })).toBe('h2')
    })

    it('does nothing when every card is collapsed', () => {
      expect(nextExpanded(null, { type: 'delete', key: 'h1' })).toBeNull()
    })
  })

  describe('blockedSave', () => {
    it('opens the first empty card', () => {
      expect(
        nextExpanded(null, { type: 'blockedSave', blankKeys: ['h3', 'h5'] }),
      ).toBe('h3')
    })

    it('moves from another open card to the first empty one', () => {
      expect(
        nextExpanded('h5', { type: 'blockedSave', blankKeys: ['h3', 'h5'] }),
      ).toBe('h3')
    })

    it('keeps the empty card open when it is already the first', () => {
      expect(
        nextExpanded('h3', { type: 'blockedSave', blankKeys: ['h3'] }),
      ).toBe('h3')
    })

    it('changes nothing when no card is empty', () => {
      expect(nextExpanded('h2', { type: 'blockedSave', blankKeys: [] })).toBe(
        'h2',
      )
      expect(
        nextExpanded(null, { type: 'blockedSave', blankKeys: [] }),
      ).toBeNull()
    })
  })
})

describe('keyAfterDelete', () => {
  const keys = ['h1', 'h2', 'h3']

  it('picks the card that takes the deleted one’s place', () => {
    expect(keyAfterDelete(keys, 'h1')).toBe('h2')
    expect(keyAfterDelete(keys, 'h2')).toBe('h3')
  })

  it('picks the previous card when the last one is deleted', () => {
    expect(keyAfterDelete(keys, 'h3')).toBe('h2')
  })

  it('returns null when it was the only card', () => {
    expect(keyAfterDelete(['h1'], 'h1')).toBeNull()
  })

  it('returns null for a key that is not in the list', () => {
    expect(keyAfterDelete(keys, 'h9')).toBeNull()
  })
})
