# Nth Reader (prototype)

A new home screen for your comic reader: a real wooden bookshelf.
- **Double-tap** a spine to open the book.
- **Long-press** a spine (~1/3 sec) to pick it up, drag it anywhere — including
  to a different shelf — and let go to re-shelve it.
- Top-left icon: **remove books**. Top-right icon: **add books / customize the shelf**.
- In the reader, the nav bar and prev/next arrows live at the bottom together,
  and auto-hide like before.

## Customize mode

Tap the menu (top right) → **🎨 Customize Shelf** to enter Customize mode —
a bottom tab bar like the reference videos: **Arrange / Decorate / Backdrop / Shelf**.

- **Arrange** — same drag-and-drop as always; dragging a book to a new spot
  now shows a "Book moved" toast with **Undo**.
- **Decorate** — **+ Add Decor** opens a picker (bust, globe, plant, candle).
  Tap a placed item to get Size / Position sliders (candles also get a Glow
  slider), plus Duplicate and Remove.
- **Backdrop** — a row of swatches to recolor the space behind the shelves.
- **Shelf** — a row of swatches to change the shelf-wood color/material.

All of it (decor placement/size/position, backdrop, shelf theme) persists
in IndexedDB and survives a reload. Note: the decor icons are emoji-based
placeholders standing in for real art assets (bust/globe/plant/candle) —
easy to swap for actual illustrations later; the interactions (add, select,
resize, reposition, duplicate, delete, glow) are what's built to match the
reference videos, not the specific art style of that app.

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
| EPUB | ✅ reads as a **scrolling document** (tap/scroll normally), not the corner-flip — reflowable text doesn't have fixed page images for the flip to grab |
| RTF | ✅ same scrolling reader as EPUB (basic formatting only — this is a minimal RTF parser, not a full one) |
| MOBI | ⚠️ best-effort — only works for **older, DRM-free** Mobipocket files. Modern Kindle purchases are DRM-protected and will show a clear error rather than a crash |
| CBR / CB7 / 7Z / RAR | ❌ not included yet — these need a RAR/7z decoder library, which isn't bundled in this build. Re-saving as `.cbz`/`.zip` works today |
| .iba (iBooks Author) | ❌ not supportable by any web app. It's a proprietary, usually DRM-wrapped Apple format with no public file spec. The app shows this explanation instead of failing silently |

## What's next
- Bring back your bubble-zoom / panel-detection code (`panels*.js`, `bubbles.js`) for the paged reader.
- Add a real RAR/7z decoder (e.g. `libarchive.js`) if CBR/CB7 support matters to you.
- Swap emoji decor for real art assets (bust/globe/plant/candle illustrations)
  once you have some — `DECOR_GLYPHS` in `js/shelf.js` is the one place to change.
- Add more decor types, more backdrop/shelf presets, or a custom-color picker
  instead of fixed swatches — `customize.js` is set up to make that a short list edit.
- Swap the flowing-text reader's slide transition for a lighter page-curl if
  you want EPUB/RTF to visually match the comic reader more closely.

## Recent fixes

**EPUB still blank on real books (this round):** the previous fix (lenient
HTML parsing) was correct but incomplete. The bigger issue: EPUB/RTF/MOBI
were paginated with CSS multi-column layout — the whole book's HTML poured
into one container and sliced into fixed-width columns. That works for a
short book, but a real omnibus can need *thousands* of columns, and
browsers cap how many columns a multi-column layout will actually render.
Past that cap, the page is just blank — which is exactly what "The Silo
Saga Omnibus" hit (reproduced it locally: 3,028 computed columns). This is
also almost certainly why scrolling didn't work — CSS columns paginate
horizontally by design, they don't scroll.

Fixed by dropping column-pagination entirely: EPUB/RTF/MOBI now render as
a plain vertically-scrolling document, same as any long web page. No
column-count ceiling, and it directly restores real scrolling. The
prev/next arrows now just scroll by one screen; the page label shows
percent-read instead of a page count; reading position is saved/restored
from scroll offset.

**On the EPUB2-vs-EPUB3 download option:** that's just a labeling choice
on the download page, not a bug — both are `.epub` files (a zip of XHTML +
an OPF manifest), and this reader doesn't distinguish between them. Either
download should work the same here.

**Comic-reader nav wouldn't come back after it auto-hid:** confirmed via
your video — tapping anywhere did nothing once the bar hid itself. Cause:
the tap-to-toggle-chrome handler only existed on the fallback (non-Turn.js)
reading path; the normal Turn.js path had no tap handler wired up at all,
since page-turning there happens via Turn.js's own drag gesture, not taps.
Added a tap handler that's always active regardless of engine — tapping
the page now reliably shows/hides the bar, and dragging a corner to flip
still works exactly as before (confirmed drag-to-flip and tap-to-toggle
don't fight each other).

**Earlier fixes, still in place:** EPUB chapters parse as lenient HTML
(handles curly quotes/em dashes/`&nbsp;` that break strict XML parsing),
EPUBs pull a real cover + title onto the shelf, and a book with genuinely
no readable content throws a clear error instead of opening blank.

## This round: Customize mode + panel split

- **Remove Books moved to a new left-side panel** (`js/remove-panel.js`),
  transplanted wholesale from the right panel. The right panel (`js/menu.js`)
  is now Add Books + the new Customize entry point.
- **New Customize mode** (`js/customize.js`): Arrange/Decorate/Backdrop/Shelf
  tabs, a decor picker sheet, per-item Size/Position/Glow sliders with
  Duplicate/Remove, swatch pickers for backdrop and shelf-wood style, and a
  "Book moved" + Undo toast — built to match the interaction flow in the
  reference videos (add-decor sheet → place → select → resize/reposition →
  duplicate/delete; tabs across the bottom; move-toast with undo).
- **`db.js` gained two new IndexedDB stores** (bumped to version 2): `decor`
  for placed items, `settings` for the backdrop/shelf-theme choice — both
  persist across reloads.
- Found and fixed two real bugs during this build, not just written and
  shipped blind:
  - `[hidden]` wasn't actually hiding the customize topbar — a `display: flex`
    rule on `.customize-topbar` outranked the browser's default `[hidden]`
    style, so the invisible bar was still intercepting taps on the header
    buttons underneath. Added a defensive `[hidden] { display: none !important; }`
    rule so this class of bug can't recur.
  - The decor Size/Position sliders initially did nothing visible: adding or
    duplicating a decor item re-fetched the *entire* decor list fresh from
    IndexedDB, which returns new object copies — so the slider kept mutating
    an orphaned reference while the shelf rendered from a different one.
    Fixed by updating the shelf's in-memory list directly instead of
    re-reading it from the database on every add/duplicate/delete.
  - Both confirmed via direct testing (not just code review) before shipping.
