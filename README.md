# Nth Reader (prototype)

A new home screen for your comic reader: a real wooden bookshelf.
- **Double-tap** a spine to open the book.
- **Long-press** a spine (~1/3 sec) to pick it up, drag it anywhere — including
  to a different shelf — and let go to re-shelve it.
- Tap **+** to import files.

Your existing page-turn engine (`page-turn.js`, the corner-drag flip) was
carried over unchanged — it just needed a book to hand it pages, so `reader.js`
here supplies that.

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
