# DESIGN.md

The design system for reprise v0.1. Tokens live in `src/styles/tokens.css`; no color, size, or timing value appears anywhere else.

## Inspirations

| Source   | What it contributes                                                 |
| -------- | ------------------------------------------------------------------- |
| Apple    | One focal element per screen. Type does the work, not decoration.   |
| Claude   | Warm off-whites, a serif for words being read, relaxed leading.     |
| Airbnb   | Soft 16px cards, generous padding, one card system used everywhere. |
| Duolingo | Exactly one signature animation, and nothing else competes with it. |

## Rules

1. **Color is semantic, never decorative.** Every color token names a job (`--color-danger`, `--color-highlight-pink`), not a hue.
2. **Pink means claim, their words only.** Pink marks what the author claims. Brand pink stays in the logo; buttons are ink.
3. **Color never stands alone.** Every color-coded thing also carries a written label.
4. **4.5:1 minimum contrast** for every text/background pair, enforced by `test/tokens.test.ts`.
5. **48px tap targets** (`--tap-min`) for everything interactive.
6. **Responsive down to 320px.** Layout caps at `--content-max` and never needs horizontal scroll.
7. **Respect `prefers-reduced-motion`.** Both duration tokens drop to `0ms`, so any animation built on them turns off automatically.
8. **Light theme only in v0.1.** Dark mode is deferred (see SCOPE.md).

## Signature animation: highlighter sweep

The one animation in the product.

- **When:** a review card appears.
- **What:** the highlight tint draws left to right behind the quote, like a highlighter pen passing over the text.
- **Timing:** `--duration-sweep` (600ms) with `--ease-out`.
- **Reduced motion:** the duration token is `0ms`, so the highlight appears instantly.
- **Status:** specified here, not implemented yet.

## Decisions

| Decision            | Chosen            | Alternative       | Revisit when                            |
| ------------------- | ----------------- | ----------------- | --------------------------------------- |
| Main button color   | Ink               | Brand pink        | Never while pink means "claim"          |
| Quote font          | System serif      | Literata web font | Quotes look wrong on a non-Apple device |
| Signature animation | Highlighter sweep | Card toss         | Sweep feels slow in daily use           |
