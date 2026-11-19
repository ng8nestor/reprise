# Parking Lot

Ideas go here, not into code.

- Capture handwritten margin notes, not just codes. v0.2 priority #1
- Custom codes per book, because the same letter means different things in different books (e.g. H = human study in Protocols). v0.2 priority #2, after handwritten margin notes
- Support readers who annotate differently (pen only, one highlighter, their own codes)
- Bookshelf library view: spines matching real covers, "Currently reading" stack (port from portfolio)
- Delete highlights, pages, and books in the app (needed to restart a book from page 1). Do not delete eval pages before eval results are merged.
- Add a book by photographing its front cover (title and author filled in); manual entry stays as a fallback
- Extract the page number from the photo instead of typing it (DECISIONS revisit trigger met: typing is friction in daily use)
- Batch capture: take or pick many page photos at once, extract them in the background, and review each when ready instead of one at a time
- Prompt v4: pass the typed page number so the model ignores the facing page (eval: 3 of 4 false positives were facing-page bleed). Measure on the same stored photos.
- Capture pen underlines as a third mark type (pen-only underlines are ignored in v0.1 by design)
