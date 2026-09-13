/* Mirrors the visible bookcase into the native Android home-screen widget. */
window.NthNativeWidget = new (class {
  available() {
    try { return Boolean(window.NthWidgetBridge?.isAvailable?.()); }
    catch (_) { return false; }
  }

  update(shelf) {
    if (!this.available() || !shelf) return;
    const firstShelf = shelf.activeBookcase * 5;
    const lastShelf = firstShelf + 5;
    const stackShelf = new Map((shelf.stacks || []).map((stack) => [String(stack.id), Number(stack.shelfIndex) || 0]));
    const books = (shelf.books || []).map((book) => {
      const shelfIndex = book.stackId && stackShelf.has(String(book.stackId))
        ? stackShelf.get(String(book.stackId))
        : (Number(book.shelfIndex) || 0);
      if (shelfIndex < firstShelf || shelfIndex >= lastShelf) return null;
      return {
        id: String(book.id), title: book.title || "Untitled", shelf: shelfIndex - firstShelf,
        slot: Number(book.slot) || 0, hue: Number(book.hue) || this.hashHue(book.title || ""),
        width: Number(book.spineWidth) || 22, height: Number(book.spineHeight) || 116,
        facedOut: Boolean(book.facedOut), stacked: Boolean(book.stackId), stackOrder: Number(book.stackOrder) || 0,
        progress: Number(book.progress) || 0,
        art: book.facedOut
          ? (book.faceCover || book.coverThumb || book.scannedSpine || "")
          : (book.scannedSpine || book.coverThumb || ""),
      };
    }).filter(Boolean);
    const decor = (shelf.decorItems || []).filter((item) => {
      const shelfIndex = Number(item.shelfIndex) || 0;
      return shelfIndex >= firstShelf && shelfIndex < lastShelf;
    }).map((item) => ({
      type: item.type || "object", shelf: (Number(item.shelfIndex) || 0) - firstShelf,
      position: Number(item.position) || 50,
    }));
    const payload = {
      version: 1, activeBookcase: shelf.activeBookcase, bookcaseCount: shelf.bookcaseCount,
      shelfTheme: shelf.root?.dataset?.shelfTheme || "walnut",
      backdrop: shelf.root?.dataset?.backdrop || "walnut", books, decor,
    };
    try { window.NthWidgetBridge.updateShelf(JSON.stringify(payload)); }
    catch (_) { /* the web/PWA shelf remains fully independent */ }
  }

  hashHue(text) {
    let hash = 0;
    for (const character of String(text)) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
    return Math.abs(hash) % 360;
  }
})();
