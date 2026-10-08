# Kill test — Oct 8, 2026

5 real annotated pages (1 biography, 4 nonfiction), shot in direct sun
with hard shadows, a sticky note, and facing pages in frame.
Model: claude-sonnet-5-5. Rules set before running: ≤1 color mistake,
≤2 code mistakes, no missing or extra sentences.

| Version                                 | Colors | Codes | Text issues                                                    |
| --------------------------------------- | ------ | ----- | -------------------------------------------------------------- |
| v1                                      | 26/26  | 7/7   | 2 boxed key terms dropped; 2 hyphens not joined                |
| v2 (+ hyphen normalizer, pen-mark rule) | 24/24  | 7/7   | 1 highlight merged across a gap; pen-underlined words included |
| v3 (+ gap rule)                         | 27/27  | 7/7   | 1 highlight cut at a line break; 1 typo                        |

**Result: PASS.** Prompt frozen at v3. These 5 pages are the dev set;
reported accuracy will come from 15 untouched pages.

## Labeling guideline

A highlight is exactly the words with highlighter on them. Pen marks
don't add or remove words. Any unhighlighted gap splits highlights.

## Lessons

- The model's warnings said it joined hyphens when the output didn't.
  Measure outputs; don't trust self-reports.
- A prompt fix (v2) caused a regression elsewhere. Rerun every page.
- Deterministic rules (hyphen joining) belong in tested code, not prompts.
