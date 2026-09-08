# Nth Reader V-0.05.00

This build turns the prototype shelf into a dimensional bookcase and adds a page-shaped reader for reflowable ebooks.

## V-0.05: growing shelves, lazy comics, and leaning books

- The bookcase starts with one shelf and always maintains one empty shelf at the bottom. Filling the trailing shelf creates the next shelf automatically.
- Every newly imported book goes to the first shelf containing no book, stack, or decoration. Books expanded from a mixed archive are assigned successively, one book per empty shelf.
- Large comics no longer decompress and decode every page before becoming usable. Turn.js receives lightweight placeholders for the complete page count while only the current page and a small nearby window are hydrated. Pages outside that window release their generated image URLs to keep memory bounded.
- **Lean** sits between **Stack Books** and **Face-Out**. Select one or more books on the same shelf, apply the lean, then adjust **Angle**, **Position**, and **Lean Left / Lean Right**. **Stand Up** returns the selected group to upright spines.
- Moving a leaning book to another shelf safely stands that individual book upright. Moving or unstacking a stack now keeps its contained books on the stack's actual shelf.

## V-0.04: face-out books and sturdier storage

- **Face-Out** now sits beside **Stack Books** in Arrange. Select one book to show its full cover, then tune **Length**, **Height**, and **Position**. **Cancel Face-Out** returns it to a normal spine; tapping an existing face-out cover in Arrange reopens its controls.
- Older low-resolution spine covers are upgraded to a larger face-out cover the first time they are selected. New imports retain a higher-resolution cover from the start.
- The vine now has a **Shelf contact** slider.
- **Space around object** now extends through zero to `-40`, allowing books to sit closer to or partially behind a decoration.
- Decoration **Duplicate** is replaced by a persisted **Face Left / Face Right** toggle.
- IndexedDB transactions recover automatically if another tab closes the active database connection. Service-worker activation no longer forcibly reloads an in-use reader, the Remove Books drawer offers Retry, and a failed import no longer requires refreshing before Add Books works again.

## V-0.03: broad imports, ZIP collections, and bookmarks

- **Mixed ZIP import:** an ordinary ZIP can contain any number of supported books and documents, including repeated formats, folders, and ZIPs nested up to three levels deep. Every supported entry becomes its own shelf book; unsupported entries are counted and skipped. An image-only ZIP remains one comic.
- **Bookmarks:** tap the heart in the reader toolbar to add or remove the current page. Open **Menu → Bookmarks** to return to an exact page or delete a bookmark. Bookmarks are stored in IndexedDB, survive refreshes, and are removed automatically with their parent book.
- **Currently Reading:** the right drawer shows the most recently opened title and its saved progress directly above Bookmarks.
- **More open formats:** FB2, DOCX, ODT, PDB/PRC (Palm/MOBI-compatible files), JSON, XML/OPF, CSV/TSV, XHTML, logs/plain text, and standalone common images now join the existing readers.

## What changed

### Photoreal decoration assets

Eight generated, transparent WebP assets live in `assets/decor/`: literary bust, antique globe, pothos, candle, trailing vine, library lamp, tea mug, and picture frame. They replace the old inline icon-like SVGs.

- Tap **Menu → Customize Shelf → Decorate → Add Decor**.
- Long-press an object and drag it between shelves.
- Tap it in Decorate mode to change **Width**, **Height**, and horizontal **Position**.
- The vine has a dedicated **Vine length** control, so it extends downward without becoming wider.
- Lamp and candle retain glow controls.
- Face direction and Remove update both the live shelf and IndexedDB immediately.

### Physical bookcase and slimmer books

The shelf now has side rails, recessed bays, thicker wood ledges, directional light, grain, edge shadows, and a real cabinet border. Backdrop presets replace the entire recess treatment instead of changing a hidden base color. Shelf presets recolor the rails and shelf material together. Upright spines are substantially slimmer and more naturally varied.

### Working book stacks

Stacks are longer, slightly irregular piles with thin page-like edges. Their controls are now:

- **Book length** — scales the stack's books.
- **Stack position** — moves the complete stack horizontally as one object. It no longer inserts gaps between attached books.
- **Unstack** — returns all books to individual spines.

Outside Customize mode, tapping a specific horizontal book opens that exact book. Long-pressing still moves the complete stack. Removing a book also repairs or dissolves its stack record so no invisible/orphaned books remain.

### One Turn.js engine for every page-based reader

EPUB, MOBI, RTF, TXT, HTML, and Markdown are chapter-paginated and passed into the same Turn.js curl engine used by comics. The pages remain live selectable HTML rather than screenshots. Only the current pages and nearby pages are hydrated, so a long book does not duplicate hundreds of full chapter trees in memory. PDF already uses the same Turn.js path.

Pagination is performed one chapter at a time. This is important: it keeps the page presentation while avoiding the former failure where a long omnibus created thousands of columns in one DOM element and eventually rendered blank pages. Reading position is stored as normalized page progress and survives reloads.

The previous CSS-only ebook turn remains available automatically if Turn.js cannot initialize.

### V-0.02 shelf and startup corrections

- Decorations now sit slightly into the ledge surface, eliminating the floating bust, globe, plant, mug, lamp, candle, and frame.
- The decor layer is above the shelf face, so trailing vines remain in front.
- Shelf layout measures every visible decoration and packs books around its true screen rectangle. A long vine also reserves space on any lower shelf it overlaps.
- **Space around object** adjusts that automatic book clearance; **Shelf contact** fine-tunes how firmly a standing object rests on the ledge.
- IndexedDB writes now resolve only after the transaction has committed with strict durability requested on supporting browsers.
- The app requests persistent site storage, serializes refresh rendering, and shows “Restoring your shelf…” until all records load.
- The Remove Books drawer opens immediately with a loading state instead of appearing to ignore its first tap.
- The service worker uses network-first loading for HTML, JavaScript, and CSS, and navigates an already-open tab into a newly activated build to prevent mixed old/new modules.

## Supported formats

| Format | Reader |
|---|---|
| CBZ / image-only ZIP / CBT | Turn.js comic pages |
| Mixed/document ZIP | Extracts every supported entry as a separate book |
| PDF | Rasterized Turn.js pages |
| EPUB | Live HTML through Turn.js |
| RTF | Live HTML through Turn.js |
| MOBI / PDB / PRC | Turn.js; best effort, DRM-free PalmDOC/classic MOBI only |
| FB2 | Reflowable Turn.js pages, including embedded images |
| DOCX / ODT | Reflowable Turn.js pages |
| TXT / TEXT / LOG | Reflowable Turn.js pages |
| HTML / HTM / XHTML | Sanitized reflowable Turn.js pages |
| Markdown / MD | Reflowable Turn.js pages |
| JSON / XML / OPF | Structured reflowable pages |
| CSV / TSV | Reflowable table pages |
| JPEG / PNG / GIF / WebP / AVIF / BMP / SVG | Single-page Turn.js reader |
| CBR / CB7 / 7Z / RAR | Not yet bundled; convert to CBZ/ZIP |
| AZW / AZW3 / IBA / DRM-locked books | Not supported |

## Quick verification

1. Add several books and the supplied EPUB.
2. Switch through every Backdrop and Shelf swatch; the entire cabinet should visibly change.
3. Add a vine, make it taller, move it, duplicate it, then remove the duplicate.
4. Stack two or more books. Adjust Book length and Stack position, exit Customize, and tap each horizontal bar.
5. Open the EPUB. Use the same corner curl as a comic for several consecutive pages, go backward, close it, and reopen it to confirm progress restoration.
6. Refresh the shelf immediately after moving an object and again after adding a book. Confirm all books, decor, stacks, themes, and positions return.
7. Import a ZIP containing two EPUBs, a PDF, a text file, and an unsupported file. Confirm four separate books appear and the skipped-entry count is shown.
8. Bookmark several pages, refresh, open Menu → Bookmarks, and jump back to each exact page.
9. On a cold load, tap Remove Books once and confirm the drawer appears immediately.

The service-worker cache key is `Nth-Reader-V-0.05.00`.
