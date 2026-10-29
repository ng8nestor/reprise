import {
  SYMBOL_GLYPHS,
  SYMBOL_NAMES,
  type Code,
  type SymbolName,
} from '../../shared/vocabulary.ts'
import './highlightSummary.css'

interface MarkListProps {
  codes: readonly Code[]
  symbols: readonly SymbolName[]
}

// The codes and symbols written next to a highlight, as quiet read-only
// outlines. Renders nothing when there are none. Shared by the summary and
// the daily review card.
export function MarkList({ codes, symbols }: MarkListProps) {
  if (codes.length === 0 && symbols.length === 0) return null

  return (
    <ul className="mark-list" aria-label="Codes and symbols">
      {codes.map((code) => (
        <li key={code} className="mark">
          {code}
        </li>
      ))}
      {symbols.map((symbol) => (
        <li key={symbol} className="mark">
          <span aria-hidden="true">{SYMBOL_GLYPHS[symbol]}</span>
          {SYMBOL_NAMES[symbol]}
        </li>
      ))}
    </ul>
  )
}
