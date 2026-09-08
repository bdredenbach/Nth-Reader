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

- **Arrange** — drag-and-drop as always (shows a "Book moved" + **Undo** toast).
  **📚 Stack Books** lets you tap 2+ books on one shelf and lay them flat as a
  pile; tap an existing stack for Size/Padding sliders and **Unstack**.
- **Decorate** — **+ Add Decor** opens a picker with 8 items: bust, globe,
  plant, candle, hanging vine, lamp, mug, picture frame. Tap a placed item
  for Size/Position sliders (candles and lamps get a Glow slider too), plus
  Duplicate/Remove — and **long-press + drag any decor item to any shelf**,
  same gesture as moving a book.
- **Backdrop** — swatches to recolor the space behind the shelves.
- **Shelf** — swatches to change the shelf-wood color/material.

All of it (decor placement/size/position/glow, stacks, backdrop, shelf
theme) persists in IndexedDB and survives a reload.

**On the decor art:** these are now hand-built shaded SVG illustrations
(gradients, highlights, drop shadows) — a real step up from flat emoji, and
each one is fully vector so it stays crisp at any size. I don't have an
image-generation tool available in this environment, so these aren't
photo-real renders like the reference app's assets; they're the most
detailed version I could hand-craft in SVG. `js/decor-art.js` is the one
file to touch if you get real illustrated assets later — swap any
`DECOR_ART[type]` function body for an `<img>` tag and placement/dragging/
sizing/glow all keep working unchanged.

**On stacking:** a stack is built from an explicit multi-select ("Stack
Books" → tap books → "Stack Selected"), not by dragging one book onto
another. Books not in a stack are still individually draggable exactly as
before. Pulling a single book back out of an *existing* stack isn't
supported yet — Unstack dissolves the whole pile back to individual spines,
which you can then re-arrange or re-stack. Flagging this now in case "move
a single book up/down/left/right" meant something more specific than that —
happy to adjust if so.

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

## This round: realistic decor, drag-anywhere, book stacking, more decor types

- **Decor redesigned as shaded SVG art** (`js/decor-art.js`) instead of flat
  emoji — see the note above on the realism ceiling without an image-gen tool.
- **Decor items are now draggable to any shelf** — same long-press gesture as
  books, unified into one drag system in `shelf.js` (`kind: 'book'|'decor'|'stack'`).
- **Book stacking**: `js/customize.js`'s Arrange tab gained "📚 Stack Books"
  (multi-select → lay flat as a pile) with its own Size/Padding sliders and
  Unstack. New `stacks` IndexedDB store (bumped to version 3).
- **4 new decor types**: hanging vine (drapes from the shelf above — a real
  `position` variant, not just a different icon), lamp, mug, picture frame —
  8 total in the picker now.
- **Spines redesigned**: covers now show as a defined inset "plate" near the
  top of the spine instead of stretching across the whole thing, with a
  proper inset bevel (light/dark edges) so the spine reads as a solid object
  with material, not a flat rectangle.
- Found and fixed two more real bugs before shipping, not just written blind:
  - The hanging vine wasn't clickable at first — but the actual cause was a
    test-script ambiguity (`text=Done` matched the topbar's Done button
    before the item panel's), not an app bug; traced it via direct DOM
    inspection (`elementFromPoint`, computed `pointer-events`) rather than
    guessing, confirmed the real cause, and fixed the test rather than
    "fixing" code that wasn't broken.
  - Multi-select-drag test flakiness (stale element handles after each
    selection re-renders the shelf) — same category, a test-harness issue
    caught and fixed rather than papered over.
- Regression-tested everything from prior rounds (Turn.js page-flip, EPUB
  scrolling on a 50-chapter fixture, comic-reader nav tap-to-show, both side
  panels, backdrop/shelf swatches, move-toast+undo) — still passing.
