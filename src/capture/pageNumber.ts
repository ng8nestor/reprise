// The page number as typed, or null if it isn't a whole number above 0.
// Digits only: "12.5", "-3", "1e3" and "" are all rejected.
export function parsePageNumber(input: string): number | null {
  const trimmed = input.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const value = Number(trimmed)
  return Number.isSafeInteger(value) && value > 0 ? value : null
}
