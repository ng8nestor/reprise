# SCOPE.md — v0.1 contract

## Status (current)

- Signed: Oct 6, 2026
- Live: Oct 29, 2026 (capture, save, daily review)
- DONE: not yet declared. Declared when every box in the DONE checklist below is ticked.
- After DONE: bug fixes only, no new features or projects.
- Soccer predictor: parked until reprise is DONE.
- Cut to v0.2: search box. (Sentry was cut, then added back on Nov 12.)

## History

- Oct 6: contract signed. Live by Oct 13, DONE Oct 20.
- Oct 11: live date moved to Oct 15 to keep all features (no cuts).
- Oct 27: DONE moved to Nov 7, cut order kept (search box, then Sentry, then filters).
- Nov 12: Sentry added back into v0.1.
- Nov 19: eval run on 16 held-out pages (see eval/RESULTS.md). DONE date left open.

## In v0.1

1. Auth: single user, Supabase email login, RLS on every table
2. Capture: one photo = one page. Pick book (or add by title), type page
   number. Server function sends photo to Claude, Zod validates the reply.
   I review/edit each highlight, then save. Photo kept in Supabase Storage.
3. Vocabulary is fixed: colors = pink | yellow. Codes = H, A, C, RCT, Obs,
   Meta, n=, M, anec, L. Symbols = ✓ ? ! ✗ →. Everything else ignored.
4. Each code/symbol belongs to ONE highlight (AI guesses nearest, I fix).
5. Daily review: 5–10 highlights, two buttons: Know it / Again.
6. Search: text search + filters for book, color, code.
7. Baseline: TypeScript, Zod, retries, error handling, loading/error/empty
   states, Sentry, tests (scheduler + parser), GitHub Actions CI.
8. Eval: 20 hand-labeled pages (5 dev pages from the kill test + 16 test
   pages from Napoleon), accuracy measured per field.
9. Design system locked before any CSS. Light theme. One signature animation.

## Deferred (v0.2+)

- Embeddings / semantic search / "chat with my highlights"
- Linking highlights via →
- Streaks, stats, notifications
- Page number extraction, book covers/ISBN, batch upload,
  two-page highlights, handwritten notes beyond codes
- Dark mode, PWA/offline, multiple users
- Notion sync, exports, social

## Cut order (if behind on Sun Oct 11)

1. Search box (filters survive)

## Rules

- New ideas go in PARKING_LOT.md, not in code.
- DONE means the checklist below is met, not that it's perfect.

## DONE checklist

- [ ] Live URL works on my phone
- [ ] RLS verified (second account sees nothing)
- [ ] Capture → review → save works end to end
- [ ] Daily review works
- [ ] Filters work (search box if not cut)
- [ ] Scheduler + parser tests pass in CI
- [ ] Sentry receives errors
- [ ] 20-page eval run, accuracy per field in README
- [ ] README written
