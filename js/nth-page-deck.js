/* Nth Page Deck
 *
 * An original page deck (html2canvas supplies EPUB snapshots) for Nth Reader. It owns only the
 * presentation of already-created page nodes; loading, pagination, progress,
 * narration, and gestures remain in the reader controllers.
 */
window.NthPageDeck = class {
  constructor(root, options = {}) {
    if (!(root instanceof HTMLElement)) throw new TypeError("NthPageDeck needs a book element.");
    this.root = root;
    this.options = options;
    this.pageCount = Math.max(1, Number(options.pages) || 1);
    this.currentPage = this.clampPage(options.page || 1);
    this.duration = Math.max(180, Number(options.duration) || 560);
    this.pageObjs = Object.create(null);
    this.events = new Map();
    this.motion = null;
    this.snapshots = new Map();
    this.snapshotQueue = Promise.resolve();
    this.destroyed = false;

    root.classList.add("nth-page-deck");
    this.size(options.width, options.height);
    Array.from(root.children).forEach((page, index) => this.registerPage(index + 1, page));
    this.showOnly(this.currentPage);
  }

  clampPage(page) {
    return Math.max(1, Math.min(this.pageCount, Math.round(Number(page) || 1)));
  }

  registerPage(number, page) {
    const pageNumber = this.clampPage(number);
    if (!(page instanceof HTMLElement)) return null;
    page.classList.add("nth-deck-page");
    page.dataset.deckPage = String(pageNumber);
    this.pageObjs[pageNumber] = [page];
    if (pageNumber !== this.currentPage) page.remove();
    return page;
  }

  data() { return { pageObjs: this.pageObjs }; }

  bind(name, handler) {
    if (typeof handler !== "function") return this;
    if (!this.events.has(name)) this.events.set(name, new Set());
    this.events.get(name).add(handler);
    return this;
  }

  emit(name, ...args) {
    for (const handler of this.events.get(name) || []) {
      try { handler({ type: name, target: this.root }, ...args); }
      catch (error) { console.error(`Nth Page Deck ${name} listener failed`, error); }
    }
  }

  pageNode(number) { return this.pageObjs[this.clampPage(number)]?.[0] || null; }

  preparePage(page, zIndex) {
    if (!page) return;
    page.style.display = "flex";
    page.style.visibility = "visible";
    page.style.backfaceVisibility = "visible";
    page.style.zIndex = String(zIndex);
    page.style.transform = "none";
    page.style.transformOrigin = "left center";
    page.style.filter = "none";
    page.style.clipPath = "none";
    page.style.removeProperty("--nth-fold");
    page.classList.remove("nth-deck-turning", "nth-deck-under");
  }

  showOnly(number) {
    const page = this.pageNode(number);
    if (!page) return false;
    // Retain the already-painted destination; reattaching it can flash in WebView.
    if (page.parentElement !== this.root) this.root.appendChild(page);
    this.preparePage(page, 2);
    for (const child of Array.from(this.root.children)) {
      if (child !== page) child.remove();
    }
    return true;
  }

  size(width, height) {
    if (this.motion) this.finishTurn(this.motion, false);
    this.snapshots?.clear();
    const w = Math.max(1, Math.round(Number(width) || this.root.clientWidth || 1));
    const h = Math.max(1, Math.round(Number(height) || this.root.clientHeight || 1));
    this.root.style.width = `${w}px`;
    this.root.style.height = `${h}px`;
    return this;
  }

  adjacentTarget(direction) {
    return this.currentPage + (direction === "next" ? 1 : -1);
  }

  canMove(direction) {
    const target = this.adjacentTarget(direction);
    return target >= 1 && target <= this.pageCount && !!this.pageNode(target);
  }

  async capturePage(page) {
    const width = this.root.clientWidth, height = this.root.clientHeight;
    const scale = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(1800000/(width*height)));
    // A standalone image can be drawn directly, including its contain fit.
    if (page.children.length === 1 && page.firstElementChild.tagName === "IMG") {
      const img = page.firstElementChild;
      await img.decode?.();
      if (!img.naturalWidth) throw new Error("Page image is not decoded");
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width*scale); canvas.height = Math.round(height*scale);
      const ctx = canvas.getContext("2d");
      ctx.scale(scale,scale); ctx.fillStyle="#0b0b0d"; ctx.fillRect(0,0,width,height);
      const fit = Math.min(width/img.naturalWidth,height/img.naturalHeight);
      const w=img.naturalWidth*fit,h=img.naturalHeight*fit;
      ctx.drawImage(img,(width-w)/2,(height-h)/2,w,h);
      return canvas;
    }
    if (!window.html2canvas) throw new Error("Page snapshot renderer unavailable");
    const host = document.createElement("div");
    host.className="page-viewport";
    Object.assign(host.style,{position:"fixed",left:"-100000px",top:"0px",right:"auto",bottom:"auto",width:`${width}px`,height:`${height}px`,overflow:"visible",pointerEvents:"none"});
    host.setAttribute("aria-hidden","true");host.setAttribute("inert","");
    const computed=window.getComputedStyle(this.root);
    for(let i=0;i<computed.length;i++) {
      const key=computed[i];if(key.startsWith("--"))host.style.setProperty(key,computed.getPropertyValue(key));
    }
    const book=document.createElement("div");book.className="longbox-turn-book nth-page-deck";
    Object.assign(book.style,{width:`${width}px`,height:`${height}px`,contain:"none"});
    const copy=page.cloneNode(true);copy.removeAttribute("id");
    for(const node of copy.querySelectorAll("[id]"))node.removeAttribute("id");
    Object.assign(copy.style,{visibility:"visible",transform:"none",clipPath:"none",filter:"none",width:`${width}px`,height:`${height}px`});
    // Preserve the resolved texture URL: inline custom-property URLs would
    // otherwise resolve relative to the document instead of the stylesheet.
    const livePaper=this.root.querySelector(".epub-turn-paper");
    const copiedPaper=copy.querySelector(".epub-turn-paper");
    if(livePaper&&copiedPaper) {
      const background=window.getComputedStyle(livePaper).backgroundImage;
      if(background)copiedPaper.style.backgroundImage=background;
    }
    book.appendChild(copy);host.appendChild(book);document.body.appendChild(host);
    try {
      // Column offsets remain part of the captured page; no live columns are
      // transformed or clipped by the turn animation itself.
      return await window.html2canvas(copy,{backgroundColor:null,scale,logging:false,removeContainer:true,scrollX:0,scrollY:0,imageTimeout:3000});
    } finally { host.remove(); }
  }

  getSnapshot(number) {
    const page=this.pageNode(number);
    if(!page?.children.length)return Promise.reject(new Error("Page is not hydrated"));
    const stamp=`${this.root.clientWidth}x${this.root.clientHeight}:${page.innerHTML}`;
    const prior=this.snapshots.get(number);
    if(prior?.stamp===stamp)return prior.promise;
    const entry={stamp,promise:null};
    entry.promise=this.snapshotQueue.then(()=>{
      if(this.destroyed||Math.abs(number-this.currentPage)>1&&number!==this.motion?.targetNumber)throw new Error("Obsolete page capture");
      return this.capturePage(page);
    });
    this.snapshotQueue=entry.promise.catch(()=>{});
    this.snapshots.set(number,entry);
    entry.promise.catch(()=>{if(this.snapshots.get(number)===entry)this.snapshots.delete(number);});
    return entry.promise;
  }

  warmSnapshots(number=this.currentPage) {
    if(this.destroyed)return;
    for(const key of this.snapshots.keys())if(Math.abs(key-number)>1)this.snapshots.delete(key);
    for(const key of [number,number+1]) {
      if(key<=this.pageCount&&this.pageNode(key)?.children.length)this.getSnapshot(key).catch(()=>{});
    }
  }

  pageBounds(page=this.pageNode(this.currentPage)) {
    const width=this.root.clientWidth,height=this.root.clientHeight;
    const paper=page?.querySelector(".epub-turn-paper");
    if(!paper)return {x:0,y:0,width,height};
    const box=paper.getBoundingClientRect(),root=this.root.getBoundingClientRect();
    if(box.width<1||box.height<1)return {x:0,y:0,width,height};
    const x=Math.max(0,box.left-root.left),y=Math.max(0,box.top-root.top);
    return {x,y,width:Math.min(box.width,width-x),height:Math.min(box.height,height-y)};
  }

  arrangeTurn(direction, targetNumber) {
    const current=this.pageNode(this.currentPage), target=this.pageNode(targetNumber);
    if(!current||!target||current===target)return null;
    const backward=direction!=="next";
    this.preparePage(current,backward?1:2);this.preparePage(target,backward?2:1);
    if(backward) {
      // 0.38.05: the previous sheet returns along the left spine, from -179.6° to flat.
      this.root.replaceChildren(current,target);
      // The wrapper includes margins around the paper. Hinging at wrapper x=0
      // moves the paper's left edge in depth, so perspective shifts its lower
      // corner away from the binding. Keep the entire paper spine at z=0.
      const pageBox=this.pageBounds(target);
      target.style.transformOrigin=`${pageBox.x}px ${pageBox.y+pageBox.height/2}px`;
      target.style.backfaceVisibility="hidden";
      target.style.transform="perspective(1800px) rotateY(-179.6deg)";
      return {current,target,sheet:target,renderer:"sheet",curl:{width:this.root.clientWidth,height:this.root.clientHeight,pageBox}};
    }
    this.root.replaceChildren(target,current);
    const pageBox=this.pageBounds(current);
    const canvas=document.createElement("canvas");canvas.className="nth-turn-canvas";
    canvas.setAttribute("aria-hidden","true");canvas.style.display="none";
    const width=this.root.clientWidth,height=this.root.clientHeight;
    const scale=Math.min(window.devicePixelRatio||1,2,Math.sqrt(1800000/(width*height)));
    canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
    this.root.appendChild(canvas);
    return {current,target,sheet:current,renderer:"canvas",curl:{width,height,pageBox,scale,layer:canvas,ctx:canvas.getContext("2d"),ready:false}};
  }

  prepareMotion(motion) {
    if(motion.renderer!=="canvas")return;
    Promise.all([this.getSnapshot(motion.fromPage),this.getSnapshot(motion.targetNumber)]).then(([front,back])=>{
      if(this.motion!==motion||this.destroyed)return;
      Object.assign(motion.curl,{front,back,ready:true});
      this.renderMotion(motion,motion.progress,motion.position?.y);
      if(motion.pendingCommit!=null)this.animateMotion(motion,motion.pendingCommit);
    }).catch(error=>{
      if(this.motion!==motion||this.destroyed)return;
      console.warn("Page capture failed; retaining live page until release",error);
      motion.captureFailed=true;
      if(motion.pendingCommit!=null)this.finishTurn(motion,motion.pendingCommit);
    });
  }

  // Clip a rectangle against the perpendicular bisector of the original and
  // dragged corner. Reflection across that crease maps the corner exactly to
  // the pointer. Both directions use the same geometry, mirrored horizontally.
  static cornerFold(width, height, corner, pointer) {
    const dx = corner.x - pointer.x, dy = corner.y - pointer.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.001) return null;
    const nx = dx / length, ny = dy / length;
    const mx = (corner.x + pointer.x) / 2, my = (corner.y + pointer.y) / 2;
    const distance = p => (p.x - mx) * nx + (p.y - my) * ny;
    const rect = [{x:0,y:0},{x:width,y:0},{x:width,y:height},{x:0,y:height}];
    const clip = sign => {
      const out = [];
      for (let i = 0; i < rect.length; i++) {
        const a = rect[i], b = rect[(i + 1) % rect.length];
        const da = distance(a) * sign, db = distance(b) * sign;
        if (da >= 0) out.push(a);
        if ((da >= 0) !== (db >= 0)) {
          const t = da / (da - db);
          out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
        }
      }
      return out;
    };
    const offset = 2 * (nx * mx + ny * my);
    const matrix = [1-2*nx*nx,-2*nx*ny,-2*nx*ny,1-2*ny*ny,offset*nx,offset*ny];
    const reflect = p => ({x:matrix[0]*p.x+matrix[2]*p.y+matrix[4],y:matrix[1]*p.x+matrix[3]*p.y+matrix[5]});
    const folded = clip(1);
    return {flat:clip(-1),folded,flap:folded.map(reflect),matrix,reflect,mx,my,nx,ny};
  }

  renderMotion(motion, progress, pointerY) {
    motion.progress=Math.max(0,Math.min(1,progress));motion.fold=motion.progress;
    const {width,height}=motion.curl;
    if(motion.renderer==="sheet") {
      const angle=-179.6*(1-motion.progress);
      motion.position={x:width*motion.progress,y:height/2};
      motion.sheet.style.transform=`perspective(1800px) rotateY(${angle}deg)`;
      motion.sheet.style.filter=`brightness(${1-0.25*Math.sin(Math.PI*Math.abs(angle)/180)})`;
      return;
    }
    const box=motion.curl.pageBox;
    const w=box.width,h=box.height;
    const corner={x:w,y:motion.flat?h/2:(motion.topCorner?0:h)};
    const requestedY=motion.flat?corner.y:(Number.isFinite(pointerY)?pointerY:corner.y+(motion.topCorner?1:-1)*h*.12*Math.sin(Math.PI*motion.progress));
    // Never fold outward across the grabbed edge. Outward pointers invert the
    // crease and can reflect almost the whole page into a detached-looking strip.
    // The same inward constraint applies to the vertically mirrored corners.
    const y=Math.max(0,Math.min(h,requestedY));
    let pointer={x:w-2*w*motion.progress,y};
    const distance=Math.hypot(pointer.x,pointer.y-corner.y);
    if(distance>w)pointer={x:pointer.x*w/distance,y:corner.y+(pointer.y-corner.y)*w/distance};
    motion.position=pointer;
    const fold=window.NthPageDeck.cornerFold(w,h,corner,pointer);motion.geometry=fold;
    if(!motion.curl.ready)return;
    const {ctx,scale,front,back,layer}=motion.curl;
    ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,width,height);
    const draw=image=>ctx.drawImage(image,0,0,width,height);
    const clip=points=>{
      ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x+box.x,p.y+box.y):ctx.moveTo(p.x+box.x,p.y+box.y));ctx.closePath();ctx.clip();
    };
    if(!fold||motion.progress<=0)draw(front);
    else if(motion.progress>=1)draw(back);
    else {
      draw(back);
      ctx.save();clip(fold.flat);draw(front);ctx.restore();
      const mx=fold.mx+box.x,my=fold.my+box.y;
      const bandWidth=Math.max(22,Math.min(58,w*.12));
      const gradient=ctx.createLinearGradient(mx-fold.nx*bandWidth/2,my-fold.ny*bandWidth/2,mx+fold.nx*bandWidth/2,my+fold.ny*bandWidth/2);
      gradient.addColorStop(0,"rgba(0,0,0,0)");gradient.addColorStop(.48,"rgba(0,0,0,.3)");gradient.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=gradient;ctx.fillRect(0,0,width,height);
      ctx.save();clip(fold.flap);
      const [a,b,c,d,e,f]=fold.matrix;
      ctx.transform(-a,-b,c,d,box.x+e+a*(box.x+w)-c*box.y,box.y+f+b*(box.x+w)-d*box.y);draw(back);ctx.restore();
      ctx.save();clip(fold.flap);
      const light=ctx.createLinearGradient(mx-fold.nx*bandWidth/2,my-fold.ny*bandWidth/2,mx+fold.nx*bandWidth/2,my+fold.ny*bandWidth/2);
      light.addColorStop(0,"rgba(255,255,255,0)");light.addColorStop(.36,"rgba(255,255,255,.24)");light.addColorStop(.5,"rgba(0,0,0,.28)");light.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=light;ctx.fillRect(0,0,width,height);ctx.restore();
    }
    // Reveal only a fully painted canvas. The browser never composites a
    // partly updated set of clipping masks and transformed live text.
    layer.style.display="block";
    motion.current.style.visibility="hidden";motion.target.style.visibility="hidden";
  }

  finishTurn(motion, commit) {
    if (!motion || this.motion !== motion) return;
    if (motion.frame != null) cancelAnimationFrame(motion.frame);
    if (commit) this.currentPage = motion.targetNumber;
    this.motion = null;
    this.showOnly(commit ? motion.targetNumber : motion.fromPage);
    // Reset the outgoing sheet only after it has left the visible layer stack.
    for(const page of [motion.current,motion.target]) {
      if(page.parentElement!==this.root)this.preparePage(page,2);
    }
    if (commit) this.emit("turned", this.currentPage);
  }

  animateMotion(motion, commit, duration = this.duration) {
    if(motion.captureFailed){this.finishTurn(motion,commit);return;}
    if(motion.renderer==="canvas"&&!motion.curl.ready){motion.pendingCommit=commit;return;}
    const start = performance.now();
    const from = motion.progress;
    const to = commit ? 1 : 0;
    const fromY = motion.position.y;
    const paperHeight=motion.curl.pageBox?.height||motion.curl.height;
    const endY = motion.flat ? paperHeight/2 : (motion.topCorner ? 0 : paperHeight);
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) { this.finishTurn(motion, commit); return; }
    const tick = () => {
      if (this.motion !== motion || this.destroyed) return;
      const elapsed = Math.min(1, (performance.now() - start) / Math.max(120, duration));
      const eased = 1 - Math.pow(1 - elapsed, 3);
      this.renderMotion(motion, from + (to - from) * eased, motion.automatic ? undefined : fromY + (endY - fromY) * eased);
      if (elapsed >= 1) this.finishTurn(motion, commit);
      else motion.frame = requestAnimationFrame(tick);
    };
    motion.frame = requestAnimationFrame(tick);
  }

  goTo(page, animate = true) {
    if (this.destroyed || this.motion) return false;
    const targetNumber = this.clampPage(page);
    if (targetNumber === this.currentPage) return true;
    const target = this.pageNode(targetNumber);
    if (!target) return false;

    const direction = targetNumber > this.currentPage ? "next" : "previous";
    this.emit("turning", targetNumber);
    if (!animate || Math.abs(targetNumber - this.currentPage) !== 1) {
      this.currentPage = targetNumber;
      this.showOnly(targetNumber);
      this.emit("turned", targetNumber);
      return true;
    }

    const arranged = this.arrangeTurn(direction, targetNumber);
    if (!arranged) return false;
    const motion = {
      ...arranged,
      direction,
      fromPage: this.currentPage,
      targetNumber,
      progress: 0,
      interactive: false,
      automatic: true,
      flat: direction !== "next",
      topCorner: false,
    };
    this.motion = motion;
    this.renderMotion(motion, 0);
    this.prepareMotion(motion);
    this.animateMotion(motion, true);
    return true;
  }

  grabStart(x, y, direction, gesture = {}) {
    if (this.destroyed || this.motion || !this.canMove(direction)) return false;
    const targetNumber = this.adjacentTarget(direction);
    this.emit("turning", targetNumber);
    const arranged = this.arrangeTurn(direction, targetNumber);
    if (!arranged) return false;
    this.motion = {
      ...arranged,
      direction,
      fromPage: this.currentPage,
      targetNumber,
      progress: 0,
      interactive: true,
      automatic: false,
      flat: direction !== "next" || (gesture.flat ?? ((Number(y)-(arranged.curl.pageBox?.y||0)) > 100 && (Number(y)-(arranged.curl.pageBox?.y||0)) < (arranged.curl.pageBox?.height||arranged.curl.height) - 100)),
      topCorner: gesture.topCorner ?? (Number(y)-(arranged.curl.pageBox?.y||0) < (arranged.curl.pageBox?.height||arranged.curl.height) / 2),
    };
    this.grabMove(x, y);
    this.prepareMotion(this.motion);
    return true;
  }

  grabMove(x, y) {
    const motion = this.motion;
    if (!motion?.interactive) return false;
    const box=motion.curl.pageBox||{x:0,y:0,width:motion.curl.width};
    const progress = motion.direction === "next"
      ? Math.max(0,Math.min(1,(box.width-(Number(x)-box.x))/(2*box.width)))
      : Math.max(0,Math.min(1,Number(x)/motion.curl.width));
    this.renderMotion(motion,progress,Number.isFinite(y)?y-box.y:motion.position?.y);
    return true;
  }

  grabEnd(commit) {
    const motion = this.motion;
    if (!motion?.interactive) return false;
    motion.interactive = false;
    const remaining = commit ? 1 - motion.progress : motion.progress;
    this.animateMotion(motion, !!commit, this.duration * Math.max(0.28, remaining));
    return true;
  }

  destroy() {
    this.destroyed = true;
    if (this.motion?.frame != null) cancelAnimationFrame(this.motion.frame);
    this.motion?.curl.layer?.remove();
    this.snapshots.clear();
    this.motion = null;
    for (const page of Object.values(this.pageObjs)) page?.[0]?.remove();
    this.pageObjs = Object.create(null);
    this.events.clear();
    this.root.classList.remove("nth-page-deck");
    this.root.replaceChildren();
  }

  turn(command, ...args) {
    switch (command) {
      case "destroy": this.destroy(); return this;
      case "page":
        if (!args.length) return this.currentPage;
        this.goTo(args[0], true); return this;
      case "next": this.goTo(this.currentPage + 1, true); return this;
      case "previous": this.goTo(this.currentPage - 1, true); return this;
      case "size": this.size(args[0], args[1]); return this;
      case "grabStart": return this.grabStart(args[0], args[1], args[2], args[3]);
      case "grabMove": return this.grabMove(args[0], args[1]);
      case "grabEnd": return this.grabEnd(args[0]);
      default: throw new Error(`Unknown Nth Page Deck command: ${command}`);
    }
  }
};
