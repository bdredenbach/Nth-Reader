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
    if (!this.pointerStart || event.pointerId !== this.pointerStart.id) return;
    const dx = event.clientX - this.pointerStart.x;
    const dy = event.clientY - this.pointerStart.y;
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
    if (!this.pointerStart || event.pointerId !== this.pointerStart.id) return;
    const dx = event.clientX - this.pointerStart.x;
    const dy = event.clientY - this.pointerStart.y;
    const travel = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
    const moved = this.pointerStart.moved;
    this.pointerStart = null;
    if (this.stage.hasPointerCapture?.(event.pointerId)) {
      this.stage.releasePointerCapture(event.pointerId);
    }
    this.resetDragPreview();
    if (!moved) return;
    this.suppressCardClick = true;
    clearTimeout(this.suppressTimer);
    this.suppressTimer = setTimeout(() => { this.suppressCardClick = false; }, 450);
    if (Math.abs(travel) >= 42) this.navigate(travel < 0 ? 1 : -1);
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
    this.overlay.hidden = false;
    document.body.classList.add("carousel-active");
    this.renderSelected();
    requestAnimationFrame(() => this.overlay.classList.add("visible"));
  }

  close() {
    this.overlay.classList.remove("visible");
    document.body.classList.remove("carousel-active");
    this.shelf.render();
    this.closeTimer = setTimeout(() => {
      this.overlay.hidden = true;
      this.preview.innerHTML = "";
    }, 230);
  }

  async navigate(direction) {
    if (this.busy) return;
    const count = this.shelf.bookcaseCount;
    if (count <= 1) return;
    // Deliberately wrap at both ends: the carousel has no first or last stop.
    const target = (this.shelf.activeBookcase + direction + count) % count;
    this.busy = true;
    const outgoing = direction > 0
      ? [{ transform: "translateX(0) rotateY(0deg) scale(1)", opacity: 1 }, { transform: "translateX(-34%) rotateY(34deg) scale(.82)", opacity: 0 }]
      : [{ transform: "translateX(0) rotateY(0deg) scale(1)", opacity: 1 }, { transform: "translateX(34%) rotateY(-34deg) scale(.82)", opacity: 0 }];
    const outgoingAnimation = this.card.animate(outgoing, { duration: 210, easing: "ease-in", fill: "forwards" });
    await outgoingAnimation.finished.catch(() => {});
    // Remove the outgoing transform before measuring the next cabinet. A
    // transformed ancestor would otherwise distort getBoundingClientRect().
    outgoingAnimation.cancel();
    this.shelf.setActiveBookcase(target, { render: false });
    this.renderSelected();
    const incoming = direction > 0
      ? [{ transform: "translateX(34%) rotateY(-34deg) scale(.82)", opacity: 0 }, { transform: "translateX(0) rotateY(0deg) scale(1)", opacity: 1 }]
      : [{ transform: "translateX(-34%) rotateY(34deg) scale(.82)", opacity: 0 }, { transform: "translateX(0) rotateY(0deg) scale(1)", opacity: 1 }];
    await this.card.animate(incoming, { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" }).finished.catch(() => {});
    this.card.getAnimations().forEach((animation) => animation.cancel());
    this.busy = false;
  }

  renderSelected() {
    const natural = this.shelf.renderBookcasePreview(this.preview, this.shelf.activeBookcase);
    const availableWidth = Math.max(1, this.card.clientWidth - 24);
    const availableHeight = Math.max(1, this.card.clientHeight - 12);
    const scale = Math.min(1, availableWidth / natural.width, availableHeight / natural.height);
    this.preview.style.setProperty("--carousel-scale", String(scale));
    if (window.syncDecorClocks) window.syncDecorClocks();
    const current = this.shelf.activeBookcase + 1;
    const empty = this.shelf.isBookcaseEmpty(this.shelf.activeBookcase);
    this.position.textContent = `Bookcase ${current} of ${this.shelf.bookcaseCount}${empty ? " · Empty" : ""}`;
    this.enter.textContent = empty ? "Open Empty Bookcase" : "Open Bookcase";
    const canRotate = this.shelf.bookcaseCount > 1;
    this.prev.disabled = !canRotate;
    this.next.disabled = !canRotate;
    this.updateButton();
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
