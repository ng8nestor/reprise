// Matches a line-break hyphenation: letter, hyphen, whitespace, lowercase
// letter ("cap- able"). A hyphen with no whitespace after it is left alone.
const LINE_BREAK_HYPHEN = /(\p{L})-\s+(\p{Ll})/gu

// Joins words the model left split across a line break: "accor- dance"
// becomes "accordance", while "well-known" is unchanged.
export function normalizeHyphens(text: string): string {
  return text.replace(LINE_BREAK_HYPHEN, '$1$2')
}
