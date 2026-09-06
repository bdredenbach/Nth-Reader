# Nth Reader (prototype)

A new home screen for your comic reader: a real wooden bookshelf.
- **Double-tap** a spine to open the book.
- **Long-press** a spine (~1/3 sec) to pick it up, drag it anywhere — including
  to a different shelf — and let go to re-shelve it.
- Tap the **menu icon** (top right) to add books or remove ones you don't want.
- In the reader, the nav bar and prev/next arrows live at the bottom together,
  and auto-hide like before.

Nth Shelf actually drives its page flip with **Turn.js** (`js/turn.js`, the
realistic drag-a-corner flipbook library), wired through your
`js/page-mode.js` — that's the default engine (`useTurnJSPageMode = true`).
The custom canvas "corner-turn" (`js/page-turn.js`) is only Nth Shelf's own
fallback for when Turn.js can't initialize.

This build ports `turn.js` and `page-mode.js` over unchanged and makes
Turn.js the primary engine here too, with the canvas engine kept as the same
fallback. I verified the corner-grab/curl visually matches Nth Shelf by
driving Turn.js's real `grabStart`/`grabMove`/`grabEnd` API directly and
comparing screenshots against the original project side by side — the
diagonal peel, light gradient along the fold, and next page revealing
underneath all match. In the reader, drag a page corner to flip it (or use
the small edge arrows / back button as a non-drag fallback).

## Format support in this build

| Format | Status |
|---|---|
| CBZ / ZIP / CBT | ✅ full corner-flip reading, via JSZip |
| PDF | ✅ full corner-flip reading — each page is rasterized to an image on the fly |
| EPUB | ✅ reads, but as **paginated flowing text** (tap left/right edges to turn), not the corner-flip — reflowable text doesn't have fixed page images for the flip to grab |
| RTF | ✅ same flowing-text reader as EPUB (basic formatting only — this is a minimal RTF parser, not a full one) |
| MOBI | ⚠️ best-effort — only works for **older, DRM-free** Mobipocket files. Modern Kindle purchases are DRM-protected and will show a clear error rather than a crash |
| CBR / CB7 / 7Z / RAR | ❌ not included yet — these need a RAR/7z decoder library, which isn't bundled in this build. Re-saving as `.cbz`/`.zip` works today |
| .iba (iBooks Author) | ❌ not supportable by any web app. It's a proprietary, usually DRM-wrapped Apple format with no public file spec. The app shows this explanation instead of failing silently |

## What's next
- Bring back your bubble-zoom / panel-detection code (`panels*.js`, `bubbles.js`) for the paged reader.
- Add a real RAR/7z decoder (e.g. `libarchive.js`) if CBR/CB7 support matters to you.
- Add decorative shelf items (like the reference video's globe/bust) — purely
  cosmetic, easy to add as absolutely-positioned PNGs per shelf.
- Swap the flowing-text reader's slide transition for a lighter page-curl if
  you want EPUB/RTF to visually match the comic reader more closely.
- The menu panel (`js/menu.js`) is intentionally small right now — add-books
  and remove-a-book — with room to grow as you add more actions to it.

## Recent fixes

**EPUB blank-page bug:** chapters were being parsed as strict XML
(`application/xhtml+xml`). Real-world EPUB prose is full of named HTML
entities — curly quotes, em dashes, `&nbsp;` — which aren't valid in
strict XML without a DTD. The XML parser was silently dropping any
paragraph that hit one, so books "opened" but the page was blank, with no
error. Chapters now parse as lenient HTML instead, which handles named
entities correctly (verified against a synthetic EPUB built to reproduce
this exactly). Also added: a clear error if a book truly has no readable
chapters (instead of a silent blank page), and EPUB cover-image/title
extraction, so EPUBs now show a real cover and title on the shelf like
CBZ/PDF books do.

**Flow-reader pagination bug:** page count for EPUB/RTF/MOBI was measured
immediately after setting the HTML, before any embedded images had
finished loading. An image loading afterward would reflow the content to
a different width than what was measured, so the page count fell out of
sync with the real content — showing partial "bleed" between pages or
landing on blank space past the real end. Pagination now waits for all
images to load/decode before measuring.
