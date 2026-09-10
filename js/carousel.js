/* Nth Reader — bookcase carousel
 * A lightweight, perspective browser for five-shelf cabinets. Only the
 * selected cabinet is interactive; the carousel preview is discarded when
 * closed so large libraries do not create a second permanent DOM tree.
 */
window.BookcaseCarousel = class {
  constructor(shelf) {
    this.shelf = shelf;
    this.overlay = document.getElementById("bookcase-carousel");
    this.stage = document.getElementById("carousel-stage");
    this.card = document.getElementById("carousel-card");
    this.preview = document.getElementById("carousel-preview");
    this.position = document.getElementById("carousel-position");
    this.openButton = document.getElementById("carousel-open-btn");
    this.openLabel = document.getElementById("carousel-open-label");
    this.prev = document.getElementById("carousel-prev-btn");
    this.next = document.getElementById("carousel-next-btn");
    this.enter = document.getElementById("carousel-enter-btn");
    this.closeButton = document.getElementById("carousel-close-btn");
    this.busy = false;
    this.pointerStart = null;
    this.suppressCardClick = false;
    this.wheelLocked = false;
    this.closeTimer = 0;
    this.suppressTimer = 0;
    this.previewCache = new Map();
    this.previewGeneration = 0;

    this.openButton.addEventListener("click", () => this.open());
    this.closeButton.addEventListener("click", () => this.close());
    this.enter.addEventListener("click", () => this.close());
    this.card.addEventListener("click", () => {
      if (this.suppressCardClick) { this.suppressCardClick = false; return; }
      this.close();
    });
    this.prev.addEventListener("click", () => this.navigate(-1));
    this.next.addEventListener("click", () => this.navigate(1));
    this.stage.addEventListener("pointerdown", (event) => this.beginDrag(event));
    this.stage.addEventListener("pointermove", (event) => this.updateDrag(event));
    this.stage.addEventListener("pointerup", (event) => this.endDrag(event));
    this.stage.addEventListener("pointercancel", () => this.cancelDrag());
    // Some Android Chromium/WebView combinations cancel pointer sequences on
    // a large button before pointerup. Use the native touch stream for fingers
    // and keep Pointer Events for mouse/pen input.
    this.stage.addEventListener("touchstart", (event) => this.beginTouch(event), { passive: true });
    this.stage.addEventListener("touchmove", (event) => this.updateTouch(event), { passive: false });
    this.stage.addEventListener("touchend", (event) => this.endTouch(event), { passive: false });
    this.stage.addEventListener("touchcancel", () => this.cancelDrag(), { passive: true });
    this.overlay.addEventListener("wheel", (event) => {
      event.preventDefault();
      if (this.wheelLocked) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (Math.abs(delta) < 12) return;
      this.wheelLocked = true;
      this.navigate(delta > 0 ? 1 : -1);
      setTimeout(() => { this.wheelLocked = false; }, 420);
    }, { passive: false });
    window.addEventListener("keydown", (event) => {
      if (this.overlay.hidden) return;
      if (event.key === "ArrowLeft") this.navigate(-1);
      if (event.key === "ArrowRight") this.navigate(1);
      if (event.key === "Escape") this.close();
    });
    window.addEventListener("nth:bookcase-changed", () => this.updateButton());
    window.addEventListener("resize", () => {
      if (!this.overlay.hidden && !this.busy) this.renderSelected();
    });
    this.shelf.onViewportChanged = () => this.updateButtonVisibility();
    this.updateButton();
    this.updateButtonVisibility();
  }

  beginDrag(event) {
    if (event.pointerType === "touch") return;
    if (this.busy || (event.pointerType === "mouse" && event.button !== 0)) return;
    if (event.target.closest(".carousel-arrow, .carousel-close-btn, .carousel-enter-btn")) return;
    this.pointerStart = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false
    };
    this.stage.setPointerCapture?.(event.pointerId);
    this.card.classList.add("carousel-card-dragging");
  }

  updateDrag(event) {
    if (event.pointerType === "touch") return;
    if (!this.pointerStart || event.pointerId !== this.pointerStart.id) return;
    this.updateGesture(event.clientX, event.clientY, event);
  }

  updateGesture(clientX, clientY, event) {
    if (!this.pointerStart) return;
    const dx = clientX - this.pointerStart.x;
    const dy = clientY - this.pointerStart.y;
    const travel = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
    if (Math.abs(travel) > 6) {
      this.pointerStart.moved = true;
      event.preventDefault();
    }
    const limit = Math.min(120, Math.max(54, this.stage.clientWidth * .24));
    const clamped = Math.max(-limit, Math.min(limit, travel));
    const progress = clamped / limit;
    this.card.style.transform = `translateX(${clamped * .28}px) rotateY(${-progress * 13}deg) scale(${1 - Math.abs(progress) * .045})`;
    this.card.style.opacity = String(1 - Math.abs(progress) * .16);
  }

  endDrag(event) {
    if (event.pointerType === "touch") return;
    if (!this.pointerStart || event.pointerId !== this.pointerStart.id) return;
    if (this.stage.hasPointerCapture?.(event.pointerId)) {
      this.stage.releasePointerCapture(event.pointerId);
    }
    this.finishGesture(event.clientX, event.clientY);
  }

  beginTouch(event) {
    if (this.busy || this.pointerStart || event.touches.length !== 1) return;
    if (event.target.closest(".carousel-arrow, .carousel-close-btn, .carousel-enter-btn")) return;
    const touch = event.touches[0];
    this.pointerStart = {
      id: `touch-${touch.identifier}`,
      x: touch.clientX,
      y: touch.clientY,
      moved: false
    };
    this.card.classList.add("carousel-card-dragging");
  }

  updateTouch(event) {
    if (!this.pointerStart || !String(this.pointerStart.id).startsWith("touch-")) return;
    const identifier = Number(String(this.pointerStart.id).slice(6));
    const touch = Array.from(event.touches).find((item) => item.identifier === identifier);
    if (touch) this.updateGesture(touch.clientX, touch.clientY, event);
  }

  endTouch(event) {
    if (!this.pointerStart || !String(this.pointerStart.id).startsWith("touch-")) return;
    const identifier = Number(String(this.pointerStart.id).slice(6));
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === identifier);
    if (!touch) return;
    if (this.pointerStart.moved) event.preventDefault();
    this.finishGesture(touch.clientX, touch.clientY);
  }

  finishGesture(clientX, clientY) {
    const dx = clientX - this.pointerStart.x;
    const dy = clientY - this.pointerStart.y;
    const travel = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
    const moved = this.pointerStart.moved;
    this.pointerStart = null;
    if (!moved) {
      this.resetDragPreview();
      return;
    }
    this.suppressCardClick = true;
    clearTimeout(this.suppressTimer);
    this.suppressTimer = setTimeout(() => { this.suppressCardClick = false; }, 450);
    if (Math.abs(travel) >= 28) {
      // Keep the released transform in place. navigate() clones that exact
      // pose so the cabinet never snaps back before completing its turn.
      this.navigate(travel < 0 ? 1 : -1, { continueFromDrag: true });
    } else {
      this.resetDragPreview();
    }
  }

  cancelDrag() {
    this.pointerStart = null;
    this.resetDragPreview();
  }

  resetDragPreview() {
    this.card.classList.remove("carousel-card-dragging");
    this.card.style.removeProperty("transform");
    this.card.style.removeProperty("opacity");
  }

  open() {
    if (document.body.classList.contains("customizing")) return;
    clearTimeout(this.closeTimer);
    this.shelf.bookcaseScrollPositions.set(this.shelf.activeBookcase, this.shelf.root.scrollTop);
    this.previewCache.clear();
    this.previewGeneration += 1;
    this.overlay.hidden = false;
    document.body.classList.add("carousel-active");
    this.renderSelected();
    requestAnimationFrame(() => this.overlay.classList.add("visible"));
  }

  close() {
    this.previewGeneration += 1;
    this.previewCache.clear();
    this.overlay.classList.remove("visible");
    document.body.classList.remove("carousel-active");
    this.shelf.render();
    this.closeTimer = setTimeout(() => {
      this.overlay.hidden = true;
      this.preview.innerHTML = "";
    }, 230);
  }

  async navigate(direction, { continueFromDrag = false } = {}) {
    if (this.busy) return;
    const count = this.shelf.bookcaseCount;
    if (count <= 1) return;
    // Deliberately wrap at both ends: the carousel has no first or last stop.
    const target = (this.shelf.activeBookcase + direction + count) % count;
    this.busy = true;
    const outgoingCard = this.transitionClone();
    const outgoingStart = continueFromDrag && outgoingCard.style.transform
      ? outgoingCard.style.transform
      : "translateX(0) rotateY(0deg) scale(1)";
    const outgoingOpacity = continueFromDrag && outgoingCard.style.opacity
      ? Number(outgoingCard.style.opacity)
      : 1;
    this.resetDragPreview();

    try {
      // The old cabinet remains in the transition clone while the prepared
      // target is installed underneath it. Both then move simultaneously,
      // eliminating the empty midpoint from the former two-stage animation.
      this.shelf.setActiveBookcase(target, { render: false });
      this.renderSelected();
      const outgoingEnd = direction > 0
        ? "translateX(-42%) rotateY(38deg) scale(.80)"
        : "translateX(42%) rotateY(-38deg) scale(.80)";
      const incomingStart = direction > 0
        ? "translateX(42%) rotateY(-38deg) scale(.80)"
        : "translateX(-42%) rotateY(38deg) scale(.80)";
      const outgoingAnimation = outgoingCard.animate([
        { transform: outgoingStart, opacity: outgoingOpacity },
        { transform: outgoingEnd, opacity: 0 }
      ], { duration: 250, easing: "cubic-bezier(.4,0,.7,1)", fill: "forwards" });
      const incomingAnimation = this.card.animate([
        { transform: incomingStart, opacity: 0 },
        { transform: "translateX(0) rotateY(0deg) scale(1)", opacity: 1 }
      ], { duration: 300, easing: "cubic-bezier(.16,.78,.22,1)", fill: "forwards" });
      await Promise.all([
        outgoingAnimation.finished.catch(() => {}),
        incomingAnimation.finished.catch(() => {})
      ]);
    } finally {
      outgoingCard.remove();
      this.card.getAnimations().forEach((animation) => animation.cancel());
      this.resetDragPreview();
      this.busy = false;
    }
  }

  transitionClone() {
    const clone = this.card.cloneNode(true);
    clone.removeAttribute("id");
    clone.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    clone.classList.remove("carousel-card-dragging");
    clone.classList.add("carousel-card-transition-clone");
    clone.setAttribute("aria-hidden", "true");
    clone.style.left = `${this.card.offsetLeft}px`;
    clone.style.top = `${this.card.offsetTop}px`;
    clone.style.width = `${this.card.offsetWidth}px`;
    clone.style.height = `${this.card.offsetHeight}px`;
    this.stage.appendChild(clone);
    return clone;
  }

  renderSelected() {
    const index = this.shelf.activeBookcase;
    const cached = this.previewCache.get(index);
    if (cached) this.restorePreview(cached);
    else this.capturePreview(this.preview, index);
    if (window.syncDecorClocks) window.syncDecorClocks();
    const current = this.shelf.activeBookcase + 1;
    const empty = this.shelf.isBookcaseEmpty(this.shelf.activeBookcase);
    this.position.textContent = `Bookcase ${current} of ${this.shelf.bookcaseCount}${empty ? " · Empty" : ""}`;
    this.enter.textContent = empty ? "Open Empty Bookcase" : "Open Bookcase";
    const canRotate = this.shelf.bookcaseCount > 1;
    this.prev.disabled = !canRotate;
    this.next.disabled = !canRotate;
    this.updateButton();
    this.prewarmNeighbors(index);
  }

  capturePreview(container, index) {
    const natural = this.shelf.renderBookcasePreview(container, index);
    const availableWidth = Math.max(1, this.card.clientWidth - 24);
    const availableHeight = Math.max(1, this.card.clientHeight - 12);
    const scale = Math.min(1, availableWidth / natural.width, availableHeight / natural.height);
    container.style.setProperty("--carousel-scale", String(scale));
    this.previewCache.set(index, {
      html: container.innerHTML,
      width: container.style.width,
      scale,
      backdrop: container.dataset.backdrop,
      shelfTheme: container.dataset.shelfTheme
    });
  }

  restorePreview(snapshot) {
    this.preview.innerHTML = snapshot.html;
    this.preview.style.width = snapshot.width;
    this.preview.style.setProperty("--carousel-scale", String(snapshot.scale));
    this.preview.dataset.backdrop = snapshot.backdrop;
    this.preview.dataset.shelfTheme = snapshot.shelfTheme;
  }

  prewarmNeighbors(index) {
    const count = this.shelf.bookcaseCount;
    if (count <= 1) return;
    const generation = this.previewGeneration;
    const candidates = [...new Set([(index + 1) % count, (index - 1 + count) % count])]
      .filter((candidate) => !this.previewCache.has(candidate));
    const schedule = window.requestIdleCallback
      ? (callback) => window.requestIdleCallback(callback, { timeout: 180 })
      : (callback) => setTimeout(callback, 24);
    const prepareNext = () => {
      if (generation !== this.previewGeneration || this.overlay.hidden || !candidates.length) return;
      const candidate = candidates.shift();
      const staging = document.createElement("div");
      staging.className = "carousel-bookcase-content shelf-root carousel-prewarm-preview";
      this.card.appendChild(staging);
      this.capturePreview(staging, candidate);
      staging.remove();
      if (candidates.length) schedule(prepareNext);
    };
    if (candidates.length) schedule(prepareNext);
  }

  updateButton() {
    if (!this.openLabel) return;
    this.openLabel.textContent = `Bookcase ${this.shelf.activeBookcase + 1}`;
    this.updateButtonVisibility();
  }

  updateButtonVisibility() {
    const root = this.shelf.root;
    const remaining = root.scrollHeight - root.clientHeight - root.scrollTop;
    const atBottom = remaining <= 24;
    const show = atBottom && !root.classList.contains("shelf-loading");
    this.openButton.classList.toggle("at-bottom", show);
    this.openButton.disabled = !show;
    this.openButton.setAttribute("aria-hidden", show ? "false" : "true");
  }
};
