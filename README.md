# Nth Reader V-0.02.00

This build turns the prototype shelf into a dimensional bookcase and adds a page-shaped reader for reflowable ebooks.

## What changed

### Photoreal decoration assets

Eight generated, transparent WebP assets live in `assets/decor/`: literary bust, antique globe, pothos, candle, trailing vine, library lamp, tea mug, and picture frame. They replace the old inline icon-like SVGs.

- Tap **Menu → Customize Shelf → Decorate → Add Decor**.
- Long-press an object and drag it between shelves.
- Tap it in Decorate mode to change **Width**, **Height**, and horizontal **Position**.
- The vine has a dedicated **Vine length** control, so it extends downward without becoming wider.
- Lamp and candle retain glow controls.
- Duplicate and Remove update both the live shelf and IndexedDB immediately.

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
| CBZ / ZIP / CBT | Turn.js comic pages |
| PDF | Rasterized Turn.js pages |
| EPUB | Live HTML through Turn.js |
| RTF | Live HTML through Turn.js |
| MOBI | Turn.js; best effort, DRM-free classic MOBI only |
| TXT | Reflowable Turn.js pages |
| HTML / HTM | Sanitized reflowable Turn.js pages |
| Markdown / MD | Reflowable Turn.js pages |
| CBR / CB7 / 7Z / RAR | Not yet bundled; convert to CBZ/ZIP |
| IBA / DRM-locked books | Not supported |

## Quick verification

1. Add several books and the supplied EPUB.
2. Switch through every Backdrop and Shelf swatch; the entire cabinet should visibly change.
3. Add a vine, make it taller, move it, duplicate it, then remove the duplicate.
4. Stack two or more books. Adjust Book length and Stack position, exit Customize, and tap each horizontal bar.
5. Open the EPUB. Use the same corner curl as a comic for several consecutive pages, go backward, close it, and reopen it to confirm progress restoration.
6. Refresh the shelf immediately after moving an object and again after adding a book. Confirm all books, decor, stacks, themes, and positions return.
7. On a cold load, tap Remove Books once and confirm the drawer appears immediately.

The service-worker cache key is `Nth-Reader-V-0.02.00`.
