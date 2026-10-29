// Which highlight card on the review screen is open for editing. At most
// one: opening a card closes the one before it. null means every card is
// collapsed, which is how the screen starts.
export type ExpandedKey = string | null

export type ExpandedEvent =
  | { type: 'open'; key: string }
  | { type: 'close'; key: string }
  // A card I just added by hand; I'll want to type into it.
  | { type: 'add'; key: string }
  | { type: 'delete'; key: string }
  // Save was blocked by empty cards. blankKeys is in page order.
  | { type: 'blockedSave'; blankKeys: readonly string[] }

export function nextExpanded(
  current: ExpandedKey,
  event: ExpandedEvent,
): ExpandedKey {
  switch (event.type) {
    case 'open':
    case 'add':
      return event.key
    case 'close':
    case 'delete':
      // Only the open card can close; the others are already collapsed.
      return current === event.key ? null : current
    case 'blockedSave':
      // The first empty card opens. If none is empty, nothing changes.
      return event.blankKeys[0] ?? current
  }
}

// Where focus goes after a card is deleted: the card that took its place
// (the next one, or the previous one if it was last), so I stay where I was
// on the page. null when no card is left or the key isn't in the list.
export function keyAfterDelete(
  keys: readonly string[],
  deletedKey: string,
): string | null {
  const index = keys.indexOf(deletedKey)
  if (index === -1) return null
  return keys[index + 1] ?? keys[index - 1] ?? null
}
