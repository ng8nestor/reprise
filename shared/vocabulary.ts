// The fixed annotation vocabulary (SCOPE.md §3). Imported by both browser
// and server code, so this file must stay dependency-free and runtime-agnostic.

export const COLORS = ['pink', 'yellow'] as const
export type Color = (typeof COLORS)[number]

export const CODES = [
  'H',
  'A',
  'C',
  'RCT',
  'Obs',
  'Meta',
  'n=',
  'M',
  'anec',
  'L',
] as const
export type Code = (typeof CODES)[number]

// Names for the pen symbols ✓ ? ! ✗ → as the model outputs them.
export const SYMBOLS = [
  'try',
  'doubt',
  'surprise',
  'disagree',
  'connects',
] as const
export type SymbolName = (typeof SYMBOLS)[number]
