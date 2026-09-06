/* Longbox Page Mode — isolated Turn.js experiment / recovered triple-tap test
 * v57: initialize with exactly one page, then add remaining pages after the
 * Turn.js instance is interactive. This isolates initialization from the
 * multi-page/image-loading path that froze on mobile.
 */
window.LongboxPageMode = (() => {
  class PageMode {
    constructor({ getIssue, getPageUrl, getIndex, setIndex, onPageChanged, onState }) {
      this.getIssue = getIssue;
      this.getPageUrl = getPageUrl;
      this.getIndex = getIndex;
      this.setIndex = setIndex;
      this.onPageChanged = onPageChanged || (() => {});
      this.onState = onState || (() => {});
      this.host = null;
      this._hostStyle = null;
      this.book = null;
      this.issueKey = null;
      this.pageCount = 0;
      this._boundResize = () => this.resize();
      this._gesture = null;
      this._cornerGesture = null;
      this._cornerTapCount = 0;
      this._cornerTapTime = 0;
      this._cornerTapX = 0;
      this._cornerTapY = 0;
      this._cornerTapSide = null;
      this._boundCornerTouchStart = (e) => this._cornerTouchStart(e);
      this._boundCornerTouchMove = (e) => this._cornerTouchMove(e);
      this._boundCornerTouchEnd = (e) => this._cornerTouchEnd(e);
      this._boundGestureStart = (e) => this._gestureStart(e);
      this._boundGestureMove = (e) => this._gestureMove(e);
      this._boundGestureEnd = (e) => this._gestureEnd(e);
      this._destroyed = false;
    }

    async destroy() {
      this._destroyed = true;
      if (this.book) {
        try { this.book.turn("destroy"); } catch (_) {}
      }
      this.book = null;
      this.issueKey = null;
      this.pageCount = 0;
      window.removeEventListener("resize", this._boundResize);
      this._removeGestureGrab();
      if (this.host) {
        this.host.innerHTML = "";

        // Turn.js needs a heavily styled absolute host. Restore every inline
        // property it borrowed, not just display, before another mode renders.
        if (this._hostStyle === null) {
          this.host.removeAttribute("style");
        } else {
          this.host.setAttribute("style", this._hostStyle);
        }
      }
      this._hostStyle = null;
    }

    async waitForImage(img) {
      if (img.complete) return;
      await new Promise(resolve => {
        const done = () => resolve();
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
        setTimeout(done, 10000);
      });
    }

    makePage(url) {
      const page = document.createElement("div");
      page.className = "longbox-turn-page";
      const img = document.createElement("img");
      img.src = url;
      img.alt = "";
      img.draggable = false;
      img.decoding = "async";
      img.loading = "eager";
      page.appendChild(img);
      return { page, img };
    }

    async render(host) {
      this._destroyed = false;
      this.host = host;
      // Remember the reader viewport's pre-Turn.js inline state so every
      // other reading mode gets the exact same container back on destroy.
      if (this._hostStyle === null) {
        this._hostStyle = host.getAttribute("style");
      }
      const issue = this.getIssue();
      if (!issue || !window.jQuery || !jQuery.fn.turn) {
        this.onState("Turn.js unavailable");
        return false;
      }

      const issueKey = issue.id ?? issue.key ?? issue.title ?? "issue";
      if (this.book && this.issueKey === issueKey) {
        this.host.style.display = "block";
        this.resize();
        return true;
      }

      await this.destroy();
      this._destroyed = false;

      host.style.display = "block";
      host.style.position = "absolute";
      host.style.inset = "0";
      host.style.width = "100%";
      host.style.height = "100%";
      host.style.overflow = "hidden";
      host.style.zIndex = "4";
      host.style.pointerEvents = "auto";

      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const rect = host.getBoundingClientRect();
      const width = Math.max(240, Math.round(rect.width || window.innerWidth));
      const height = Math.max(360, Math.round(rect.height || window.innerHeight));
      const pageCount = Math.max(1, Number(issue.pageCount) || 1);

      // Critical test: only the first page exists when Turn.js initializes.
      const firstUrl = await this.getPageUrl(0);
      if (!firstUrl) {
        this.onState("first-page-missing");
        return false;
      }

      const book = document.createElement("div");
      book.className = "longbox-turn-book";
      book.style.width = width + "px";
      book.style.height = height + "px";
      const first = this.makePage(firstUrl);
      book.appendChild(first.page);
      host.innerHTML = "";
      host.appendChild(book);

      await this.waitForImage(first.img);
      if (this._destroyed) return false;

      const $book = jQuery(book);
      this.pageCount = 1;
      this.onState("initializing=1");

      try {
        $book.turn({
          width,
          height,
          display: "single",
          autoCenter: true,
          gradients: true,
          acceleration: true,
          elevation: 0.05,
          duration: 600,
          direction: "ltr",
          cornerSize: 0,
          pages: 1,
          page: 1
        });
      } catch (err) {
        this.onState("init-error=" + (err?.message || err));
        return false;
      }

      this.book = $book;
      this.issueKey = issueKey;
      this._installGestureGrab(book);
      this.onState("ready=1");

      $book.bind("turned", (_event, page) => {
        const index = Math.max(0, Number(page) - 1);
        this.setIndex(index);
        this.onPageChanged(index);
      });
      $book.bind("turning", (_event, page) => this.onState(`turning=${page}`));

      window.addEventListener("resize", this._boundResize, { passive: true });

      // Now that Turn.js is alive, add pages one at a time. If a particular
      // page cannot be loaded, skip it rather than blocking the whole reader.
      this.onState(`adding=${pageCount - 1}`);
      for (let i = 1; i < pageCount; i++) {
        if (this._destroyed || !this.book) return false;
        const url = await this.getPageUrl(i);
        if (!url) continue;
        const { page, img } = this.makePage(url);
        await this.waitForImage(img);
        if (this._destroyed || !this.book) return false;
        try {
          this.book.turn("addPage", page, i + 1);
          this.pageCount = i + 1;
          this.onState(`added=${this.pageCount}`);
        } catch (err) {
          this.onState(`add-error=${i + 1}:${err?.message || err}`);
          break;
        }
      }

      if (!this._destroyed && this.book) {
        const target = Math.max(1, Math.min(Number(this.getIndex()) + 1, this.pageCount));
        try { this.book.turn("page", target); } catch (_) {}
        this.onState(`ready=${this.pageCount}`);
      }
      return true;
    }

    _installGestureGrab(book) {
      this._removeGestureGrab();

      // Capture corner touches before Turn.js sees them. This is the
      // recovered triple-tap test: corner taps are owned here so Turn.js
      // cannot begin a native page turn on tap #1.
      book.addEventListener("touchstart", this._boundCornerTouchStart, {
        capture: true, passive: false
      });
      book.addEventListener("touchmove", this._boundCornerTouchMove, {
        capture: true, passive: false
      });
      book.addEventListener("touchend", this._boundCornerTouchEnd, {
        capture: true, passive: false
      });
      book.addEventListener("touchcancel", this._boundCornerTouchEnd, {
        capture: true, passive: false
      });
      this._cornerTouchBook = book;

      // Preserve the existing custom horizontal drag for non-corner gestures.
      book.addEventListener("touchstart", this._boundGestureStart, { passive: true });
      book.addEventListener("touchmove", this._boundGestureMove, { passive: false });
      book.addEventListener("touchend", this._boundGestureEnd, { passive: true });
      book.addEventListener("touchcancel", this._boundGestureEnd, { passive: true });
      book.addEventListener("pointerdown", this._boundGestureStart, { passive: true });
      book.addEventListener("pointermove", this._boundGestureMove, { passive: false });
      book.addEventListener("pointerup", this._boundGestureEnd, { passive: true });
      book.addEventListener("pointercancel", this._boundGestureEnd, { passive: true });
      this._gestureBook = book;
    }

    _removeGestureGrab() {
      const cornerBook = this._cornerTouchBook;
      if (cornerBook) {
        cornerBook.removeEventListener("touchstart", this._boundCornerTouchStart, true);
        cornerBook.removeEventListener("touchmove", this._boundCornerTouchMove, true);
        cornerBook.removeEventListener("touchend", this._boundCornerTouchEnd, true);
        cornerBook.removeEventListener("touchcancel", this._boundCornerTouchEnd, true);
        this._cornerTouchBook = null;
      }

      const book = this._gestureBook;
      if (!book) return;
      book.removeEventListener("touchstart", this._boundGestureStart);
      book.removeEventListener("touchmove", this._boundGestureMove);
      book.removeEventListener("touchend", this._boundGestureEnd);
      book.removeEventListener("touchcancel", this._boundGestureEnd);
      book.removeEventListener("pointerdown", this._boundGestureStart);
      book.removeEventListener("pointermove", this._boundGestureMove);
      book.removeEventListener("pointerup", this._boundGestureEnd);
      book.removeEventListener("pointercancel", this._boundGestureEnd);
      this._gestureBook = null;
      this._gesture = null;
    }

    _cornerInfo(e) {
      if (!this._cornerTouchBook) return null;
      const p = e.touches?.[0];
      if (!p) return null;

      const rect = this._cornerTouchBook.getBoundingClientRect();
      const x = p.clientX - rect.left;
      const y = p.clientY - rect.top;

      const corner = 100;
      const nearLeft = x <= corner;
      const nearRight = x >= rect.width - corner;
      const nearTop = y <= corner;
      const nearBottom = y >= rect.height - corner;

      if (!(nearLeft || nearRight) || !(nearTop || nearBottom)) return null;

      const side = nearLeft ? "left" : "right";
      return { p, rect, x, y, side };
    }

    _cornerTouchStart(e) {
      const info = this._cornerInfo(e);
      if (!info) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      this._cornerGesture = {
        x0: info.p.clientX,
        y0: info.p.clientY,
        lastX: info.p.clientX,
        lastY: info.p.clientY,
        rect: info.rect,
        side: info.side,
        moved: false,
        triggered: false
      };
    }

    _cornerTouchMove(e) {
      const g = this._cornerGesture;
      if (!g) return;

      const p = e.touches?.[0];
      if (!p) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      const dx = p.clientX - g.x0;
      const dy = p.clientY - g.y0;
      g.lastX = p.clientX;
      g.lastY = p.clientY;

      if (!g.triggered &&
          Math.abs(dx) >= 40 &&
          Math.abs(dx) >= Math.abs(dy) * 1.5) {
        g.moved = true;
        g.triggered = true;
        g.direction = dx < 0 ? "next" : "prev";

        const x = Math.max(
          1, Math.min(g.rect.width - 1, p.clientX - g.rect.left)
        );
        const y = Math.max(
          1, Math.min(g.rect.height - 1, p.clientY - g.rect.top)
        );

        try {
          if (!this.book.turn("grabStart", x, y, g.direction)) {
            g.triggered = false;
          }
        } catch (_) {
          g.triggered = false;
        }
      } else if (g.triggered) {
        const x = Math.max(
          1, Math.min(g.rect.width - 1, p.clientX - g.rect.left)
        );
        const y = Math.max(
          1, Math.min(g.rect.height - 1, p.clientY - g.rect.top)
        );
        try { this.book.turn("grabMove", x, y); } catch (_) {}
      }
    }

    _cornerTouchEnd(e) {
      const g = this._cornerGesture;
      if (!g) return;

      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (g.triggered) {
        const dx = g.lastX - g.x0;
        const commit = Math.abs(dx) > Math.max(90, g.rect.width * 0.30);
        try { this.book.turn("grabEnd", commit); } catch (_) {}
        this._cornerTapCount = 0;
        this._cornerGesture = null;
        return;
      }

      const now = performance.now();
      const sameCorner =
        this._cornerTapSide === g.side &&
        Math.hypot(
          g.x0 - this._cornerTapX,
          g.y0 - this._cornerTapY
        ) < 70 &&
        (now - this._cornerTapTime) < 500;

      this._cornerTapCount = sameCorner
        ? this._cornerTapCount + 1
        : 1;

      this._cornerTapTime = now;
      this._cornerTapX = g.x0;
      this._cornerTapY = g.y0;
      this._cornerTapSide = g.side;

      if (this._cornerTapCount >= 3) {
        const direction = g.side === "right" ? "next" : "prev";
        try {
          if (direction === "next") this.next();
          else this.prev();
        } catch (_) {}

        this._cornerTapCount = 0;
        this._cornerTapTime = 0;
        this._cornerTapSide = null;
      }

      this._cornerGesture = null;
    }

    _gestureStart(e) {
      if (!this.book || !this._gestureBook) return;
      const p = e.touches?.[0] || e;
      if (!p || typeof p.clientX !== "number") return;

      const rect = this._gestureBook.getBoundingClientRect();
      const x = p.clientX - rect.left;
      const y = p.clientY - rect.top;
      const corner = 110;
      const nearCorner =
        (x < corner || x > rect.width - corner) &&
        (y < corner || y > rect.height - corner);

      // Don't compete with Turn.js's native corner-grab gesture.
      if (nearCorner) {
        this._gesture = null;
        return;
      }

      this._gesture = {
        x0: p.clientX,
        y0: p.clientY,
        lastX: p.clientX,
        lastY: p.clientY,
        active: true,
        triggered: false,
        middle: true,
        intentStarted: performance.now()
      };
    }

    _gestureMove(e) {
      const g = this._gesture;
      if (!g || !g.active || !this.book) return;
      const p = e.touches?.[0] || e;
      if (!p || typeof p.clientX !== "number") return;

      const dx = p.clientX - g.x0;
      const dy = p.clientY - g.y0;
      g.lastX = p.clientX;
      g.lastY = p.clientY;

      if (!g.triggered) {
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
        if (performance.now() - g.intentStarted < 90) return;
      }

      const rect = this._gestureBook.getBoundingClientRect();
      let localDx = dx;
      // Small amount of resistance just after the gesture begins makes the
      // sheet feel less twitchy and prevents tiny finger movements from
      // throwing the fold around.
      if (g.triggered) {
        const resistance = Math.min(Math.abs(localDx), 18) * 0.25;
        localDx += localDx < 0 ? resistance : -resistance;
      }
      const x = Math.max(1, Math.min(rect.width - 1, g.x0 + localDx - rect.left));
      const y = Math.max(1, Math.min(rect.height - 1, p.clientY - rect.top));

      if (!g.triggered) {
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;

        g.triggered = true;
        g.direction = dx < 0 ? "next" : "prev";

        const started = this.book.turn("grabStart", x, y, g.direction);
        if (!started) {
          g.triggered = false;
          return;
        }
      } else {
        this.book.turn("grabMove", x, y);
      }

      e.preventDefault();
    }

    _gestureEnd() {
      const g = this._gesture;
      if (g && g.triggered && this.book) {
        const rect = this._gestureBook?.getBoundingClientRect();
        const dx = g.lastX - g.x0;
        const width = rect?.width || window.innerWidth;
        // Commit after pulling roughly a quarter of the sheet; otherwise
        // let Turn.js spring the page back.
        const commit = Math.abs(dx) > Math.max(90, width * 0.30);
        try {
          this.book.turn("grabEnd", commit);
        } catch (_) {}
      }
      this._gesture = null;
    }


    resize() {
      if (!this.book || !this.host) return;
      const rect = this.host.getBoundingClientRect();
      const width = Math.max(240, Math.round(rect.width || window.innerWidth));
      const height = Math.max(360, Math.round(rect.height || window.innerHeight));
      try { this.book.turn("size", width, height); } catch (_) {}
    }

    next() { if (this.book) this.book.turn("next"); }
    prev() { if (this.book) this.book.turn("previous"); }
    goTo(index) {
      if (!this.book) return;
      const page = Math.max(1, Math.min(index + 1, this.pageCount));
      this.book.turn("page", page);
    }
  }
  return PageMode;
})();
