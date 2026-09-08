# Nth Reader V-0.01.00

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

### EPUB/RTF/MOBI page reader

Reflowable books now open as one right-hand paper page with visible sheets underneath, a spine edge, page number, curled lower corner, button navigation, and touch/pointer page turns. Drag inward from the right side to advance or from the left side to go back.

Pagination is performed one chapter at a time. This is important: it keeps the page presentation while avoiding the former failure where a long omnibus created thousands of columns in one DOM element and eventually rendered blank pages. Reading position is stored as normalized page progress and survives reloads.

Comics and PDFs continue to use the existing Turn.js comic reader path unchanged.

## Supported formats

| Format | Reader |
|---|---|
| CBZ / ZIP / CBT | Turn.js comic pages |
| PDF | Rasterized Turn.js pages |
| EPUB | Reflowable paper-page reader |
| RTF | Reflowable paper-page reader |
| MOBI | Best effort, DRM-free classic MOBI only |
| CBR / CB7 / 7Z / RAR | Not yet bundled; convert to CBZ/ZIP |
| IBA / DRM-locked books | Not supported |

## Quick verification

1. Add several books and the supplied EPUB.
2. Switch through every Backdrop and Shelf swatch; the entire cabinet should visibly change.
3. Add a vine, make it taller, move it, duplicate it, then remove the duplicate.
4. Stack two or more books. Adjust Book length and Stack position, exit Customize, and tap each horizontal bar.
5. Open the EPUB. Drag the lower/right half inward several consecutive times, go backward from the left, close it, and reopen it to confirm progress restoration.

The service-worker cache key is `Nth-Reader-V-0.01.00`, so an installed copy fetches this build's new scripts and assets rather than retaining the prototype shell.
