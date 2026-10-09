# DECISIONS.md

| Decision               | Chosen                                       | Alternative                    | Revisit when                                             |
| ---------------------- | -------------------------------------------- | ------------------------------ | -------------------------------------------------------- |
| Page number            | Typed by me                                  | AI extracts it                 | Typing it feels like friction in daily use               |
| Code ownership         | One highlight                                | Whole page                     | Reassigning codes on review takes >30s per page          |
| Eval size              | 20 pages                                     | 50+ pages                      | Accuracy numbers swing a lot between prompt versions     |
| Code storage           | List column                                  | Separate codes table           | Codes need their own data (descriptions, colors, stats)  |
| Review scheduling      | Leitner boxes (1/3/7/14/30 days)             | SM-2 (Anki-style)              | Reviews feel too easy or too hard for 2+ weeks straight  |
| Book kind              | Kept                                         | Dropped                        | Never (it's how I annotate)                              |
| Running TS scripts     | Native Node type stripping                   | tsx                            | A script needs syntax Node can't strip                   |
| Parse retry            | Resend with the bad reply + error            | Fresh blind resend             | Retries rarely fix anything                              |
| Output format          | Text + Zod parsing                           | Structured outputs             | Eval shows parse failures; measure before/after          |
| Hyphen joining         | Code normalizer after parsing                | Prompt instruction             | A real "pre- and post-war" style hyphen shows up in eval |
| Extraction prompt      | extract-v3, frozen for v0.1                  | More tuning on the 5 dev pages | The 15-page test set shows a repeated pattern            |
| Cross-table ownership  | Composite foreign keys (id, user_id)         | exists() checks in policies    | Never: schema rules apply to every role                  |
| Server database access | None; browser writes with the user's session | service_role key in /api       | A server function must write data the user can't         |
| Data API exposure      | Explicit grants, auto-expose off             | Supabase default grants        | Never                                                    |
