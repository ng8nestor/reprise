// Bump PROMPT_VERSION whenever PROMPT changes so eval results stay comparable.
export const PROMPT_VERSION = 'extract-v1'

export const PROMPT = `You are extracting highlighted passages from a photo of ONE page of a printed book.

The reader uses exactly two highlighter colors:
- pink: can look magenta or rose; has a blue-ish tint
- yellow: can look lime or pale gold; has a green-ish tint
Under warm indoor light both can look orange. Decide by comparing them to each
other on the same page. Never output any other color.

For each highlight:
- text: only the highlighted words, exactly as printed. Join words split by a
  line-break hyphen ("con-" + "tinue" = "continue"). Don't fix spelling or
  finish cut-off sentences.
- A highlight is one continuous run of one color, even across several lines.
  If the color changes, start a new highlight.
- color: "pink" or "yellow"
- position: 1 for the highlight nearest the top of the page, then 2, 3...

The reader also writes in pen in the margins:
- Codes, exact spelling: H, A, C, RCT, Obs, Meta, n=, M, anec, L
  ("n=" is often followed by a number like n=40; output just "n=")
- Symbols, output by name:
  ✓ = "try"   ? = "doubt"   ! = "surprise"   ✗ = "disagree"   → = "connects"
Attach each code or symbol to the ONE highlight whose lines are vertically
closest to it. Ignore all other handwriting, pen underlines without
highlighter, and printed text that isn't highlighted.

If something is hard to read, make your best guess and add a short note to
"warnings".

Respond with ONLY this JSON and no other text:
{
  "highlights": [
    { "position": 1, "color": "pink", "text": "...", "codes": ["RCT"], "symbols": ["doubt"] }
  ],
  "warnings": []
}
If there are no highlights, return {"highlights": [], "warnings": []}.`
