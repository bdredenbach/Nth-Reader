/* First-use tours. Only present features; never import, delete, or alter library items. */
window.FeatureGuide = class {
  constructor(controllers) {
    Object.assign(this, controllers);
    this.seen = {}; this.active = null; this.ready = false; this.internal = false;
    this.pending = new Map(); this.key = 'featureGuides.v1';
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'feature-guide';
    this.dialog.setAttribute('aria-labelledby', 'guide-title');
    this.dialog.innerHTML = `<div class="guide-focus" aria-hidden="true"></div><section class="guide-card"><div class="guide-count"></div><h2 id="guide-title"></h2><p class="guide-copy"></p><div class="guide-actions"><button type="button" class="guide-finish">Finish tutorial</button><button type="button" class="guide-next">Next →</button></div></section>`;
    document.body.append(this.dialog);
    this.card = this.dialog.querySelector('.guide-card');
    this.next = this.dialog.querySelector('.guide-next');
    this.next.onclick = () => this.advance();
    this.dialog.querySelector('.guide-finish').onclick = () => this.finish();
    this.dialog.addEventListener('cancel', e => { e.preventDefault(); this.finish(); });
    window.addEventListener('resize', () => this.position());
    window.visualViewport?.addEventListener('resize', () => this.position());
    this.watch(this.menu, 'open', () => this.request('welcome'));
    this.watch(this.customize, 'enter', () => this.request('customize'));
    this.watch(this.customize, 'setTab', tab => this.request('tab-' + tab));
    this.watch(this.customize, 'openDecorPicker', () => this.request('decor-picker'));
    this.watch(this.customize, 'addDecor', () => { this.request('decor-item'); this.libraryChanged(); });
    this.watch(this.customize, 'selectFaceOut', () => this.request('face-out'));
    this.watch(this.customize, 'createStack', () => this.request('stack'));
    this.watch(this.customize, 'createLean', () => this.request('lean'));
    this.watch(this.removePanel, 'open', () => this.request('manage'));
    this.watch(this.carousel, 'open', () => this.request('carousel'));
    this.watch(this.reader, 'open', () => this.request('reader'));
    this.watch(this.reader.readingStyle, 'togglePanel', () => this.request('reading-style'));
    this.watch(this.reader.voiceReader, 'toggleSettings', () => this.request('voice'));
    this.watch(this.reader, 'openPageJump', () => this.request('page-jump'));
    this.watch(this.spineScanner, 'open', () => this.request('scan'));
  }

  watch(object, method, after) {
    if (typeof object?.[method] !== 'function') return;
    const original = object[method]; const guide = this;
    object[method] = function (...args) {
      const internal = guide.internal;
      const result = original.apply(this, args);
      const done = () => { if (!internal) after(...args); };
      if (result?.then) result.then(done, () => {}); else done();
      return result;
    };
  }

  async init() {
    try { this.seen = await NthDB.settings.get(this.key, {}) || {}; } catch (_) {}
    // Wait for splash removal, then give the untouched shelf three seconds.
    while (document.getElementById('launch-splash')) await this.delay(200);
    await this.delay(3000);
    this.ready = true;
    this.request('welcome');
    this.libraryChanged();
  }
  delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  visible(selector) {
    const el = document.querySelector(selector);
    return Boolean(el && el.getClientRects().length && !el.closest('[hidden]'));
  }
  shelfIdle() {
    return this.reader.els.root.hidden && !this.customize.active
      && this.carousel.overlay.hidden && this.removePanel.els.panel.hidden
      && this.spineScanner.panel.hidden && this.spineScanner.infoPanel.hidden
      && this.backup.els.dialog.hidden && !document.querySelector('dialog[open]');
  }
  libraryChanged() {
    if (!this.ready) return;
    if (this.shelf.books.length) this.request('first-book');
    const first = this.shelf.activeBookcase * 5;
    const items = [...this.shelf.books, ...this.shelf.decorItems];
    if (Array.from({length:5}, (_, i) => first+i).every(i => items.some(item => Number(item.shelfIndex) === i))) this.request('more-bookcases');
  }
  request(id) {
    if (!this.ready || this.internal || this.seen[id] || this.pending.has(id)) return;
    this.pending.set(id, true);
    clearTimeout(this.timer); this.timer = setTimeout(() => this.pump(), 500);
  }
  pump() {
    if (this.active || document.hidden || document.querySelector('dialog[open]')) { this.timer = setTimeout(() => this.pump(), 750); return; }
    for (const id of this.pending.keys()) {
      if (this.seen[id]) { this.pending.delete(id); continue; }
      const tour = this.tour(id);
      if (!tour) { this.pending.delete(id); continue; }
      if (!tour.can()) continue;
      this.pending.delete(id); this.start(id, tour); return;
    }
    if (this.pending.size) this.timer = setTimeout(() => this.pump(), 750);
  }
  tour(id) {
    const step = (target, title, copy, prepare) => ({target,title,copy,prepare});
    const context = (selector, steps) => ({can:()=>this.visible(selector), steps});
    const arrange = [
      step('#customize-panel','Make the shelf yours','Arrange lets you stack books, show a cover face-out, or lean a group. Choose a mode, then select the books it asks for.'),
      step('#shelf-root','Move your books','Press and hold a book to pick it up, then drag it to its new position. Drag toward an edge to move between shelves.'),
      step('#customize-tabbar','More ways to personalize','Decorate adds ornaments. Backdrop and Shelf change the colors and finish. Done returns you to reading.')];
    switch (id) {
      case 'welcome': return {can:()=>this.shelfIdle(), cleanup:()=>this.menu.close(), steps:[
        step('#menu-add-btn','Welcome to your bookshelf','Use + Add Books to choose books or comics from your device. Your library will appear on these shelves.',()=>this.menu.open()),
        step('#menu-scan-btn','Your physical books, too','Scan Physical Book lets you use a photo to create a shelf entry for a printed book or link its appearance to an imported book.'),
        step('#menu-customize-btn','Style your library','Customize Shelf opens tools for arranging books, adding decorations, and changing the shelf finish.'),
        step('.menu-backup-actions','Keep a copy','Back Up Library exports your library and settings. Restore Library imports a saved backup. Keep that file somewhere safe.'),
        step('#menu-bookmarks-btn','Pick up where you left off','Currently Reading and Bookmarks help you return to your books. Finish this guide to start your library.') ]};
      case 'first-book': return {can:()=>this.shelfIdle() && this.menu.els.panel.hidden, cleanup:()=>{this.customize.exit();this.removePanel.close();}, also:['customize','manage','tab-arrange'], steps:[
        step('#customize-panel','Your first book is here','Let’s look at the tools for arranging it.',()=>this.customize.enter()), ...arrange,
        step('#remove-book-list','Download or remove a book','The left menu lists your books. Download saves a copy of an available source file. Remove deletes its library entry; this tour won’t remove anything.',async()=>{this.customize.exit();await this.removePanel.open();}),
        step('#remove-open-btn','Both menus are always nearby','Use the left menu to manage books and the right menu to add or customize. You’re ready to explore.',()=>this.removePanel.close())]};
      case 'customize': return {...context('#customize-panel', arrange), also:['tab-arrange']};
      case 'tab-arrange': return context('#customize-panel', arrange);
      case 'tab-decorate': return {can:()=>this.customize.active && this.customize.tab==='decorate',steps:[step('#customize-panel','Decorate your shelves','Choose Add Decor to browse ornaments. After placing one, tap it while customizing to adjust its size, position, and spacing.')]};
      case 'tab-backdrop': case 'tab-shelf': return {can:()=>this.customize.active && this.customize.tab===id.slice(4),steps:[step('#customize-panel','Choose a finish','Tap a swatch to preview and save a new look. Your books and decorations stay in place.')]};
      case 'decor-picker': return context('#decor-picker-sheet', [step('#decor-category-tabs','Find a decoration','Browse categories or use Search to find an ornament. Tap one to place it on your shelf.')]);
      case 'decor-item': return {can:()=>this.customize.active && Boolean(this.customize.selectedDecor),steps:[
        step('#customize-panel','Your first decoration','Use these controls to adjust size and position. Space around the object controls how close neighboring books can sit.'),
        step('#shelf-root','Place it just right','Press and hold the decoration to move it. Tap it again in Customize to reopen its controls. Photo frames also offer a photo chooser and fitting controls.') ]};
      case 'face-out': case 'stack': case 'lean': return context('#customize-panel',[step('#customize-panel','Fine-tune the arrangement','Use the displayed sliders and actions to adjust your selection. The controls also let you undo this arrangement or return books upright.')]);
      case 'manage': return context('#remove-panel',[step('#remove-book-list','Manage your books','Download saves an available source file. Remove deletes a book from this library after confirmation. Close this panel to return to the shelf.')]);
      case 'more-bookcases': return {can:()=>this.shelfIdle() && this.menu.els.panel.hidden, steps:[step('#carousel-open-btn','Room for more books','Your shelves are filling up! More bookcases are created automatically as you add items. Tap the bookcase button to browse them; you don’t need to create one manually.')]};
      case 'carousel': return context('#bookcase-carousel',[step('#carousel-card','Your bookcases','Swipe or use the arrows to browse your bookcases. Tap a bookcase to open it and return to your shelves.')]);
      case 'reader': return {...context('#reader-view',[
        step('#page-viewport','Welcome to your book','Swipe or drag to turn pages. Tap the page to reveal reading controls.',()=>this.reader.showChrome()),
        step('#reader-page-label','Jump to a page','Tap the page number to choose where to read.'),
        step('#reader-bookmark-btn','Save your place','Tap the heart to bookmark this page. Find saved pages in the right-side shelf menu.'),
        step('#reader-back-btn','Return to your shelf','Use Shelf or Android’s Back button when you’re done. Your reading position is saved.')]),cleanup:()=>this.reader.showChrome()};
      case 'reading-style': return context('#reading-style-panel',[step('#reading-style-panel','Make reading comfortable','Choose a font, adjust text size and spacing, and switch the paper theme. The book will reflow to match your settings.')]);
      case 'voice': return context('#voice-reader-settings',[step('#voice-reader-settings','Listen offline','Choose an installed offline voice, set the speed, and choose whether pages turn automatically. Use Read to start and pause. Android can keep reading with the screen off.')]);
      case 'page-jump': return context('#reader-page-jump',[step('#reader-page-jump','Find your page','Enter a page number or move the slider, then choose Go to Page. Cancel keeps your current place.')]);
      case 'scan': return context('#spine-scanner',[step('#spine-scanner','Add a physical book','Adjust the photo crop to fit the spine, then follow the next step to enter its details or link an imported book.')]);
    }
  }
  async start(id, tour) {
    this.active = {id,tour,index:0}; this.previousFocus = document.activeElement;
    this.dialog.showModal(); await this.render();
  }
  async render() {
    const active = this.active; if (!active) return;
    this.next.disabled = true; this.internal = true;
    const step = active.tour.steps[active.index];
    try { await step.prepare?.(); await this.delay(260); }
    catch (error) { console.warn('Guide unavailable', error); this.finish(); return; }
    finally { this.internal = false; }
    if (this.active !== active) return;
    this.dialog.querySelector('.guide-count').textContent = `Nth Reader · ${active.index+1} of ${active.tour.steps.length}`;
    this.dialog.querySelector('h2').textContent = step.title;
    this.dialog.querySelector('.guide-copy').textContent = step.copy;
    if (!this.reader.els.root.hidden) { this.reader.showChrome(); clearTimeout(this.reader._chromeTimer); }
    const target = document.querySelector(step.target);
    if (target && target.getBoundingClientRect().height < window.innerHeight / 2) target.scrollIntoView({block:'nearest'});
    this.next.textContent = active.index === active.tour.steps.length-1 ? 'Done ✓' : 'Next →';
    this.next.disabled = false; this.position(); this.next.focus();
  }
  position() {
    if (!this.active) return;
    const target = document.querySelector(this.active.tour.steps[this.active.index].target);
    const box = target?.getBoundingClientRect(); const focus = this.dialog.querySelector('.guide-focus');
    const h = window.innerHeight, w = window.innerWidth;
    focus.hidden = !box || !box.width || !box.height;
    if (!focus.hidden) Object.assign(focus.style,{left:Math.max(4,box.left-4)+'px',top:Math.max(4,box.top-4)+'px',width:Math.min(w-8,box.width+8)+'px',height:Math.min(h-8,box.height+8)+'px'});
    this.card.style.top = box && box.top > h/2 ? 'max(16px, env(safe-area-inset-top))' : 'auto';
    this.card.style.bottom = box && box.top > h/2 ? 'auto' : 'max(16px, env(safe-area-inset-bottom))';
  }
  advance() {
    if (!this.active || this.next.disabled) return;
    if (++this.active.index >= this.active.tour.steps.length) this.finish(); else this.render();
  }
  finish() {
    if (!this.active) return false;
    const {id,tour} = this.active;
    this.active = null; this.dialog.close();
    this.seen[id] = true;
    for (const other of tour.also || []) this.seen[other] = true;
    NthDB.settings.set(this.key, {...this.seen}).catch(()=>{});
    this.internal = true;
    try { tour.cleanup?.(); } finally { this.internal = false; }
    if (!this.reader.els.root.hidden) this.reader.showChrome();
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
    this.timer = setTimeout(()=>this.pump(), 600);
    return true;
  }
};
