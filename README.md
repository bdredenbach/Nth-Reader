# Nth Reader V-0.31.02

## V-0.31.02: seated page and deeper book block

- Adds a theme-matched inner-gutter shadow so the live reading page appears seated inside the physical binding.
- Lengthens the generated book slightly beneath the reader, revealing more of the layered lower page block while preserving the fitted top seam.
- Applies the gutter treatment to both the Turn.js reader and its CSS fallback without changing the readable area or pagination.

## V-0.31.01: fitted lower book edge

- Brings the physical book's lower page block up against the readable page and exposes its layered edge across the full width.
- Keeps the generated top seam aligned while allowing the binding and bottom pages to extend naturally beneath the reader.
- Uses the same photorealistic Paper, Sepia, and Night artwork as the side curl, so the side and lower edges remain perfectly matched.

## V-0.31.00: physical open-book reader

- Adds three coordinated, high-resolution WebP book underlays for Paper, Sepia, and Night reading themes.
- Places the live HTML page over a stationary photorealistic open book, exposing a raised left leaf, central binding, and layered page block along the bottom.
- Keeps the physical book stationary while Turn.js curls only the readable page.
- Aligns the underlay to the live page after pagination and device resizing without changing text layout, gestures, bookmarks, narration, or page count.
- Preserves the existing lightweight CSS fallback and keeps comics, images, and fixed-layout PDF pages unchanged.

## V-0.30.00: expanded offline font library

- Adds fifteen genuine bundled reading fonts: Alegreya, Atkinson Hyperlegible, Cormorant Garamond, Crimson Pro, EB Garamond, Lexend, Libre Baskerville, Literata, Lora, Merriweather, Noto Sans, Nunito Sans, Roboto Slab, Source Serif, and Vollkorn.
- Organizes the font menu into Built in, Literary & serif, and Modern & accessible sections.
- Subsets the new fonts to broad Latin, punctuation, symbols, and accented characters, keeping all fifteen to roughly 1.1 MB combined.
- Waits for a selected bundled font to load before repaginating, preventing fallback-font measurements from clipping or shifting finished pages.
- Caches every font for fully offline PWA reading. License texts are preserved in `assets/fonts/licenses/` (SIL Open Font License or Apache License, as applicable).

## V-0.29.00: personalized reading styles

- Adds a matching **Aa** toolbar immediately above the bottom reader navigation for every reflowable book.
- Includes quick smaller/larger text buttons and a one-tap Paper, Sepia, or Night theme cycle.
- The expanded style tray provides Book, Classic, Modern, and Clear device-safe fonts; 14–26px type; line spacing; paragraph spacing; and left/justified alignment.
- Typography changes repaginate the live HTML book while preserving the reader's current percentage rather than returning to the beginning.
- Reading choices are saved in IndexedDB and restored across books, refreshes, and PWA launches.
- The style toolbar fades with narration and navigation, but remains available while its settings tray is open.
- Comics, images, and fixed-layout PDF pages remain visually untouched because their typography is baked into the page artwork.

## V-0.28.00: native read-aloud with automatic page turns

- Adds a compact read-aloud toolbar beneath the Nth logo for reflowable books and text-bearing PDFs.
- Uses the voices exposed by the phone or browser, preferring on-device voices and never sending book text to an Nth Reader service.
- Includes play/pause, previous/next sentence, five reading speeds, voice selection, and a remembered automatic-page-turn preference.
- Extracts only words physically visible inside the current CSS-column page instead of narrating hidden text from the rest of the chapter.
- Highlights the active sentence where the browser supports the CSS Highlight API and always mirrors it in the narration status line.
- Turns the real Turn.js page at page end and resumes narration after the next page has landed.
- Hides narration for comics, images, and PDFs without extractable text, without changing their existing reader behavior.
- Fades the narration toolbar with the normal navigation and cancels speech safely when the reader closes or relayouts.

## V-0.27.00: photographed covers and native browser installation

- Adds an optional front-cover photograph to the physical-book scanner, using the same four-corner perspective correction as spine photographs.
- Keeps the spine and cover as independently adjustable crops within one scan session.
- Uses the corrected cover for Face-Out display and the physical-book information card.
- Can apply both a photographed spine and cover to an existing digital book without changing its readable source, progress, arrangement, or bookmarks.
- Removes the in-app Install button, install guide, and install-event interception. The manifest, service worker, icons, and offline reader remain active, while installation is handled through the browser menu.

## V-0.26.00: photograph real book spines

- Adds **Scan Physical Book** to the main menu with camera and gallery support supplied by the phone's image picker.
- Provides a touch-friendly, numbered four-corner crop so skewed or trapezoidal spine photographs can be straightened.
- Rotates photographs, resets crop corners, previews the corrected result, and records a title plus optional author.
- Saves a photographed spine as a lightweight physical-only shelf book on the next empty shelf.
- Opens a physical-only entry as a collection information card instead of reporting a missing reader source.
- Can instead apply the photographed spine to an existing EPUB, comic, PDF, or other digital book while preserving its source, progress, shelf position, and bookmarks.
- Compresses corrected artwork to WebP where supported and performs all image processing locally on the device.

## V-0.25.03: continuous carousel motion

- Continues the bookcase turn from the exact finger-release pose instead of snapping back to center first.
- Crossfades outgoing and incoming cabinets simultaneously, removing the empty midpoint between them.
- Prepares the neighboring bookcases during idle time so shelf packing and photo-frame layout do not interrupt the next swipe.
- Keeps the preview cache limited to the current carousel session and discards it on close.

## V-0.25.02: compact carousel crown

- Right-aligns the carousel title block beside the centered app icon.
- Shortens the helper text to **Swipe Any Direction** so it fits comfortably on mobile.

## V-0.25.01: Android carousel gesture fallback

- Uses Android's native touch stream for finger swipes when a browser cancels Pointer Events over the bookcase preview button.
- Keeps Pointer Events for mouse and pen input without double-turning on touchscreens.
- Lowers the swipe threshold slightly so comfortable drags rotate reliably while taps still open normally.

## V-0.25.00: circular, touch-responsive bookcase carousel

- Makes vertical swipes rotate the carousel as naturally as horizontal swipes and mouse-wheel scrolling.
- Gives the selected bookcase a live tilt and slide response while it follows the user's finger.
- Wraps continuously in both directions from the last bookcase to the first and vice versa.
- Keeps the arrow buttons and tap-to-open controls for users who prefer them.
- Preserves each bookcase's saved shelf position when opening it from the carousel.

## V-0.24.04: ornate persistent bookcase crown

- Replaces the plain Nth Reader title with a centered 48×48 app icon in a 62px carved-wood bookcase crown.
- Keeps the crown visible on the shelf, customization screen, carousel, and reader.
- Reserves the device safe area above the crown content so iPhone status indicators no longer overlap controls.
- Preserves the existing shelf menus, Customize title and Done button, carousel controls, and reader navigation.
- Adds safe-area padding to both slide-out drawers.

## V-0.24.03: self-repairing manifest link

- Recreates the page's `rel=manifest` link during the earliest head script if a cached document shell lacks it.
- Repeats the repair from the installer script, allowing a freshly updated script to repair an older cached HTML document.
- Points both repair paths to a newly versioned manifest URL and reports whether the link had to be restored.

## V-0.24.02: field-by-field Chrome install audit

- Reports the live manifest HTTP status, MIME type, JSON parsing, app name, start URL, display mode, related-app preference, and both required icon fetches.
- Bypasses service-worker interception for manifest requests so Chrome evaluates the current GitHub Pages response directly.
- Registers the service worker with an explicit app scope and `updateViaCache: "none"`.
- Advances both the manifest URL and offline shell version together to prevent stale install metadata.

## V-0.24.01: truthful PWA install diagnostics

- Makes `manifest.webmanifest` the primary linked manifest and versions its URL to bypass a stale Chrome manifest cache.
- Validates the live manifest requirements and reports the active service-worker state and version in the install panel.
- Shows **Install Now** only after Chrome actually supplies its native install event.
- Replaces the artificial countdown and indefinite “preparing” message with accurate Android installation guidance.
- Keeps `manifest.json` as an identical compatibility copy and offline-cache entry.

## V-0.24: conservative Android manifest compatibility

- Uses a conventional `manifest.json` as the single manifest linked by the page.
- Keeps `manifest.webmanifest` as an identical fallback copy.
- Uses explicit `/Nth-Reader/` identity, start, scope, and icon URLs instead of relative URL resolution.
- Removes the optional `display_override` member, leaving the smallest conservative standalone-install configuration.
- Caches both manifest filenames so either remains available offline.

## V-0.23: early native-install capture

- Captures Chrome's one-shot `beforeinstallprompt` event in the document head, before the reader, shelf, format, and customization scripts load.
- Preserves an early event until the visible installer is ready, eliminating a race that could leave Check Again waiting forever.
- Starts service-worker registration during initial parsing rather than at the end of the load event.
- Keeps late-event handling as a fallback and reports that the startup listener is armed.
- Adds explicit manifest language and text-direction metadata.

## V-0.22: dependable guided installation

- The Install Nth Reader action is always visible in the right drawer until the app is installed.
- The app now reports live install readiness instead of silently hiding its button while Chrome's engagement requirement is pending.
- A first visit can finish service-worker control with a safe, user-requested refresh and return directly to the install guide.
- Once Chrome exposes its native prompt, the same button launches the real installed PWA flow rather than creating a browser shortcut.
- Android guidance explains Chrome's one-tap and 30-second engagement requirement; iPhone/iPad guidance points to Share → Add to Home Screen.

## V-0.21: installable PWA and Nth app icon

- Adds a complete web app manifest with standalone display, theme colors, identity, scope, and book-app metadata.
- Adds a purpose-built Nth Reader icon family for browser tabs, iPhone home screens, Android launchers, and adaptive masks.
- A native Install Nth Reader action appears in the right drawer when the browser exposes its install prompt.
- The manifest and every icon size are included in the versioned offline shell cache.
- Once installed, Nth Reader opens in its own app window while retaining the existing offline-first shelf and reader behavior.

## V-0.20: perspective-correct wooden photo frame

- The wooden gallery frame now uses a measured four-corner opening that follows the artwork's 11% top-to-bottom perspective shift.
- The photograph remains independently cropped and upright while the opening itself supplies the parallelogram mask.
- Adds a persistent Opening Slant control from -20.0% to +20.0% in 0.1% steps.
- Reset Opening restores the frame's calibrated perspective without changing the selected photo or its crop controls.

## V-0.19: fine photo rotation and unobtrusive carousel access

- Adds a persistent Photo Rotate slider from -10.00° to +10.00° in exact 0.01° increments.
- Reset Crop and newly selected photos restore rotation to 0.00° along with the centered zoom and position.
- The floating Bookcase button is hidden while browsing a cabinet and appears only upon reaching the bottom of that cabinet.
- Leaving the bottom hides and disables the button again so it cannot cover books or decorations during normal scrolling.

## V-0.18: precision gallery-frame cropping

- Each gallery frame now uses a calibrated opening based on its actual transparent artwork dimensions.
- The frame artboard preserves its natural aspect ratio inside independently resized Width and Height bounds, keeping the photo aligned at every size.
- Adds persistent Photo Zoom, Photo Left / Right, and Photo Up / Down sliders for every filled frame.
- Adds Reset Crop, and replacing a photo starts the new image from a clean centered crop.
- A subtle inner-edge shadow makes the photo appear mounted behind the frame rather than pasted over it.

## V-0.17: fitted frame photos and edge-to-bookcase dragging

- Gallery photos now live inside a clipped frame window instead of retaining their original screen-sized dimensions.
- The photo window uses percentage geometry, so it stays aligned and scales with independent Width and Height changes.
- While dragging a book, stack, or decoration, holding it at the far left or right edge for a moment opens the adjacent bookcase without dropping the item.
- An edge cue names the destination bookcase; moving away from the edge cancels it, preventing accidental carousel changes while rearranging.

## V-0.16: expanded decoration collection

- Adds 48 high-resolution decorations: wildlife bookends, glass animals, pottery, ornate boxes, ten succulents, four air plants, three framed paintings, and four empty photo frames.
- The decoration picker is organized into named categories with quick-filter chips and search.
- Empty photo frames open the device photo picker when tapped. Chosen photos are resized for dependable local storage and remain attached to the frame across refreshes.
- Every new object remains independently movable, resizable, reversible, and starts at Width 100, Height 100, and Space around object -40.
- New image files are compressed WebP assets, decoded asynchronously, and cached for offline use.

## V-0.15.01: faithful carousel composition

- Carousel previews now use the exact same natural-width coordinate system as the interactive shelf.
- Books, lean groups, stacks, face-out covers, and decorations are packed before the completed cabinet is uniformly scaled.
- Collision spacing and percentage-based decoration positions no longer shift when entering carousel mode.
- Preview scale is calculated from the available frame dimensions and updates after an orientation or viewport change.

## V-0.15: five-shelf bookcase carousel

- Shelves are presented as five-shelf bookcases without rewriting existing shelf records.
- The Bookcase button opens a perspective carousel with Previous/Next arrows, horizontal swipe, mouse-wheel/trackpad, and keyboard navigation.
- The selected cabinet zooms back into the normal interactive shelf view.
- Each cabinet remembers its own vertical scroll position.
- New books, archive entries, and decorations fill empty shelves in the active cabinet first, then continue into the next cabinet.
- One empty trailing bookcase is always available, and only the active preview is rendered while browsing.

## V-0.14: verified source-file storage and repair

- New and repaired books use the browser's origin-private file storage when available, avoiding dependence on one large IndexedDB `File`/Blob record. Browsers without that API retain the existing strict atomic IndexedDB fallback.
- The complete file is written and its stored size verified before book metadata is allowed onto the shelf. A readable sample from both the beginning and end is checked after import; a failed verification rolls the incomplete entry back.
- Existing IndexedDB sources remain readable, so this upgrade does not reset or discard the current library.
- If an older shelf entry has already lost its source, **Add Books** can now repair it in place: select the same original filename and the app reconnects it without losing shelf position, stacks, lean/face-out settings, progress, or bookmarks.
- The missing-source message now explains that the shelf entry is safe and gives the repair action instead of requiring deletion.
- Persistent browser storage is requested again on every file-picker selection, when the browser is most able to honor the user gesture.

## V-0.13: compact leaning groups

- Leaning groups now include a persisted **Space around objects** slider ranging from -40 to 28 and starting at -40.
- Leaned books are packed using their true upright spine width rather than the much wider bounding rectangle created by rotation. Increasing the angle therefore no longer fans the group apart.
- The default -40 spacing produces a compact, slightly overlapping bundle; raising the slider progressively opens the group and its neighboring clearance.
- Working-shelf focus now runs again after every lean-slider render, keeping the edited group immediately above the controls for the duration of an adjustment.
- The shelf remains manually scrollable whenever a slider is not actively being changed.

## V-0.12: working-shelf focus

- Selecting a decoration, stack, face-out book, or leaning group brings its shelf ledge immediately above the slider panel, keeping the edited object and its controls visually connected.
- Beginning another slider adjustment restores that working shelf if it has drifted out of view.
- The shelf is not locked: it remains freely scrollable between adjustments, so other shelves and objects can still be inspected whenever needed.
- The final shelf can also reach the working position because the existing control-panel clearance remains part of the shelf's scrollable area.

## V-0.11: décor sizing, placement, and touch refinements

- Every newly added decoration starts at Width 100, Height 100, and Space around object -40.
- Working-clock hands are positioned against the clock artwork's actual contained dimensions, so independently changing Width or Height no longer pulls the hands away from the dial center.
- Shelf items now require a deliberate 340 ms hold before pickup. A vertical swipe made before that hold scrolls the shelf instead of accidentally lifting the item.
- A newly added decoration uses the first completely empty shelf, matching book and archive imports. The bookcase then creates another empty shelf below it automatically.

## V-0.10: living shelf collection

- Sixteen new photorealistic, transparent shelf assets join the original collection: a carved walnut working clock, three hand-blown glass animals, white-tiger and heroic figure bookends, three ornate vessels, two cozy airplants, two wire sculptures, and three framed paintings.
- The clock's hour, minute, and second hands use the phone or computer's local time and continue updating while it is on the shelf.
- Bookends begin with close book clearance and can be flipped with Face Left / Face Right, making either side of a book row or leaning group appear physically supported.
- Every new decoration retains the existing independent Width, Height, Position, Shelf Contact, spacing, direction, drag/drop, and removal controls.
- The expanded picker is height-limited and scrollable so all twenty-four decorations remain reachable on small phones.

## V-0.09: mobile shelf and control gestures

- The shelf remains vertically scrollable while an arrangement or decoration control sheet is open.
- Bottom padding follows the control sheet's real height, so every shelf can scroll fully above it.
- Control sheets can grow to 58% of the usable viewport, and their action buttons remain pinned at the bottom on shorter screens.
- Decorations begin dragging as soon as intentional movement is detected, preventing the browser from scrolling instead of moving the object.
- Books, stacks, and face-out covers use a shorter hold-to-pick-up gesture; a quick vertical swipe beginning on a book scrolls the shelf instead.
- Active drags capture the pointer, cleanly handle interrupted gestures, and auto-scroll near the visible shelf area's top or bottom edge.

## V-0.08: full-bay drag and drop

- Books, face-out books, stacks, and decorations can be dropped anywhere in the open space above a shelf, not only on its thin wooden ledge.
- The shelf compartment under the finger receives the item, while horizontal position still determines where books and stacks land.
- A warm full-bay highlight and “Drop on this shelf” label show the active destination.
- Small misses along shelf boundaries and bookcase side rails are accepted; releases clearly outside the bookcase still cancel safely.

## V-0.07: direct arrangement editing and stable saves

- Tapping an already leaning book while using Lean reopens that entire group's Angle, Position, and direction controls.
- Existing stacks and face-out books likewise reopen their own controls instead of starting a second arrangement operation.
- Arranged objects can be tapped from any Customize tab; the app switches to Arrange automatically.
- Shelf refreshes wait for pending drag and slider saves, preventing an older layout from snapping back over the newest one.
- Stack creation, movement, and removal save related book and stack records atomically so a shelf cannot briefly combine mismatched states.

## V-0.06: large-library shelf performance

- Source files now live in a dedicated IndexedDB store, separate from shelf metadata.
- Shelf rendering, drawers, moving, stacking, leaning, face-out controls, and progress saves no longer read or rewrite a large comic archive.
- Existing V-0.05 libraries migrate automatically on the first V-0.06 launch; books and shelf arrangements are preserved.
- Opening a book retrieves its source file only when the reader actually needs it.
- Closing or finishing an import explicitly releases the parsed archive, page URLs, and reader DOM so a large comic cannot keep consuming memory behind the shelf.

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
- The service worker uses network-first loading for HTML, JavaScript, and CSS. It activates without forcibly reloading a reader or interrupting an import/database action.

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

The service-worker cache key is `Nth-Reader-V-0.31.02`.
