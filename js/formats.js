/* Nth Reader — formats.js
 * Turns a source File/Blob into a normalized book object:
 *   { kind: "paged", pageCount, getPageUrl(i) }   -- image-per-page, drives the corner page-turn
 *   { kind: "flow",  html }                        -- reflowable text, drives the column paginator
 *
 * Supported now:
 *   CBZ / image ZIP (paged)                    -- via JSZip
 *   CBT (paged, images in an uncompressed tar) -- native parser
 *   PDF                                         -- via pdf.js, rasterized to canvas per page
 *   EPUB                                        -- via JSZip, spine chapters concatenated to flow html
 *   RTF                                         -- minimal RTF -> text/html, flow
 *   MOBI (unencrypted / DRM-free only)          -- best-effort PalmDOC decompression, flow
 *   FB2 / DOCX / ODT                            -- reflowable document pages
 *   TXT / HTML / Markdown / structured text     -- sanitized reflowable text
 *
 * Not supported: CBR / CB7 / 7Z (need a rar/7z codec not bundled here) and
 * .iba (iBooks Author). iBA is a proprietary, typically DRM-wrapped Apple format
 * with no public spec — no browser-side reader (this one included) can open it.
 * We surface a clear message instead of silently failing.
 */
window.NthFormats = (function () {

  function extOf(name) {
    const m = /\.([a-z0-9]+)$/i.exec(name || "");
    return m ? m[1].toLowerCase() : "";
  }

  const IMAGE_RE = /\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i;
  const IMPORTABLE_EXTENSIONS = new Set([
    "cbz", "cbt", "pdf", "epub", "rtf", "mobi", "pdb", "prc", "fb2",
    "docx", "odt", "txt", "text", "log", "html", "htm", "xhtml", "md", "markdown", "json", "xml", "opf",
    "csv", "tsv", "jpg", "jpeg", "png", "gif", "webp", "avif", "bmp", "svg", "zip",
  ]);

  // ---------- CBZ / ZIP (image archive) ----------
  async function loadImageArchive(file) {
    const zip = await JSZip.loadAsync(file);
    const entries = Object.values(zip.files)
      .filter(f => !f.dir && IMAGE_RE.test(f.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
    if (!entries.length) throw new Error("No images found in archive.");

    const urlCache = new Array(entries.length).fill(null);
    async function getPageUrl(i) {
      if (urlCache[i]) return urlCache[i];
      const blob = await entries[i].async("blob");
      const url = URL.createObjectURL(blob);
      urlCache[i] = url;
      return url;
    }
    function releasePageUrl(i) {
      if (!urlCache[i]) return;
      URL.revokeObjectURL(urlCache[i]);
      urlCache[i] = null;
    }
    return {
      kind: "paged",
      pageCount: entries.length,
      getPageUrl,
      releasePageUrl,
      async coverUrl() { return getPageUrl(0); },
    };
  }

  // Comic Book TAR. CBT is an uncompressed tar archive, so it does not need
  // a native/WASM codec like RAR or 7z.
  async function loadTarImageArchive(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const decoder = new TextDecoder();
    const entries = [];
    for (let offset = 0; offset + 512 <= bytes.length;) {
      const header = bytes.subarray(offset, offset + 512);
      if (header.every((byte) => byte === 0)) break;
      const textField = (start, length) => decoder.decode(header.subarray(start, start + length)).replace(/\0.*$/, "").trim();
      const name = `${textField(345, 155)}${textField(345, 155) ? "/" : ""}${textField(0, 100)}`;
      const size = parseInt(textField(124, 12).replace(/\0/g, "").trim() || "0", 8);
      if (!Number.isFinite(size) || size < 0 || offset + 512 + size > bytes.length) throw new Error("This CBT archive is damaged.");
      if (header[156] !== 53 && IMAGE_RE.test(name)) entries.push({ name, start: offset + 512, size });
      offset += 512 + Math.ceil(size / 512) * 512;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));
    if (!entries.length) throw new Error("No images found in CBT archive.");
    const cache = new Array(entries.length).fill(null);
    const getPageUrl = async (i) => {
      if (cache[i]) return cache[i];
      const entry = entries[i];
      cache[i] = URL.createObjectURL(new Blob([bytes.slice(entry.start, entry.start + entry.size)]));
      return cache[i];
    };
    const releasePageUrl = (i) => {
      if (!cache[i]) return;
      URL.revokeObjectURL(cache[i]);
      cache[i] = null;
    };
    return { kind: "paged", pageCount: entries.length, getPageUrl, releasePageUrl, async coverUrl() { return getPageUrl(0); } };
  }

  // ---------- PDF (rasterized per page) ----------
  async function loadPdf(file) {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const urlCache = new Array(pdf.numPages).fill(null);

    async function renderPage(i) {
      const page = await pdf.getPage(i + 1);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      const blob = await new Promise(res => canvas.toBlob(res, "image/png"));
      return URL.createObjectURL(blob);
    }
    async function getPageUrl(i) {
      if (urlCache[i]) return urlCache[i];
      const url = await renderPage(i);
      urlCache[i] = url;
      return url;
    }
    function releasePageUrl(i) {
      if (!urlCache[i]) return;
      URL.revokeObjectURL(urlCache[i]);
      urlCache[i] = null;
    }
    return {
      kind: "paged",
      pageCount: pdf.numPages,
      getPageUrl,
      releasePageUrl,
      async coverUrl() { return getPageUrl(0); },
    };
  }

  // ---------- EPUB (flow) ----------
  function parseXml(str, label) {
    const doc = new DOMParser().parseFromString(str, "application/xml");
    if (doc.querySelector("parsererror")) {
      throw new Error(`This EPUB's ${label} is malformed XML and couldn't be parsed.`);
    }
    return doc;
  }

  async function loadEpub(file) {
    const zip = await JSZip.loadAsync(file);
    const containerEntry = zip.file("META-INF/container.xml");
    if (!containerEntry) throw new Error("This doesn't look like a valid EPUB (missing META-INF/container.xml).");
    const containerXml = await containerEntry.async("text");
    const containerDoc = parseXml(containerXml, "container.xml");
    const opfPath = containerDoc.querySelector("rootfile")?.getAttribute("full-path");
    if (!opfPath || !zip.file(opfPath)) throw new Error("This EPUB's container.xml doesn't point to a readable content file.");
    const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
    const opfXml = await zip.file(opfPath).async("text");
    const opfDoc = parseXml(opfXml, "content.opf");

    const manifest = {}; // id -> { href, mediaType, properties }
    opfDoc.querySelectorAll("manifest > item").forEach(item => {
      manifest[item.getAttribute("id")] = {
        href: opfDir + item.getAttribute("href"),
        mediaType: item.getAttribute("media-type") || "",
        properties: item.getAttribute("properties") || "",
      };
    });
    const spineIds = Array.from(opfDoc.querySelectorAll("spine > itemref")).map(r => r.getAttribute("idref"));
    // <dc:title> — querySelector can't match the namespaced tag by local name
    // reliably across browsers, so fall back to a plain tagName scan.
    const titleEl = Array.from(opfDoc.getElementsByTagName("*")).find(el => el.localName === "title");
    const title = titleEl?.textContent?.trim();

    // Chapters are parsed as lenient HTML, not strict XML: real-world EPUB
    // prose (curly quotes, em dashes, &nbsp; etc. as named HTML entities) is
    // routinely NOT well-formed XML, and a strict application/xhtml+xml
    // parse silently drops any paragraph that trips on it — the book "opens"
    // but the page is blank. text/html handles named entities natively.
    let html = "";
    let chapterFailures = 0;
    for (const id of spineIds) {
      const entryInfo = manifest[id];
      const zEntry = entryInfo && zip.file(entryInfo.href);
      if (!zEntry) continue;
      try {
        const chapterMarkup = await zEntry.async("text");
        const doc = new DOMParser().parseFromString(chapterMarkup, "text/html");
        const body = doc.body;
        if (body && body.innerHTML.trim()) {
          html += `<section class="chapter">${body.innerHTML}</section>`;
        }
      } catch (err) {
        chapterFailures++;
        console.warn("Nth Reader: skipped an unreadable EPUB chapter", entryInfo.href, err);
      }
    }

    if (!html.trim()) {
      throw new Error(
        chapterFailures > 0
          ? "Couldn't read any chapters from this EPUB — every chapter file failed to parse."
          : "This EPUB has no chapters listed in its spine."
      );
    }

    // Inline images so they survive outside the zip context.
    const container = document.createElement("div");
    container.innerHTML = html;
    const imgs = container.querySelectorAll("img, image");
    for (const img of imgs) {
      const srcAttr = img.getAttribute("src") || img.getAttribute("xlink:href");
      if (!srcAttr) continue;
      const norm = new URL(srcAttr, "https://x/" + opfDir).pathname.replace(/^\//, "");
      const entry = zip.file(norm) || zip.file(decodeURIComponent(norm));
      if (entry) {
        const blob = await entry.async("blob");
        img.setAttribute("src", URL.createObjectURL(blob));
      }
    }

    // Best-effort cover: EPUB3 manifest property, or the classic OPF
    // <meta name="cover" content="ID"/> pointer, or just the first image.
    let coverHref =
      Object.values(manifest).find(m => m.properties.includes("cover-image"))?.href;
    if (!coverHref) {
      const coverId = opfDoc.querySelector('meta[name="cover"]')?.getAttribute("content");
      coverHref = coverId && manifest[coverId]?.href;
    }
    if (!coverHref) {
      coverHref = Object.values(manifest).find(m => m.mediaType.startsWith("image/"))?.href;
    }
    const coverEntry = coverHref && zip.file(coverHref);

    return {
      kind: "flow",
      html: container.innerHTML,
      title,
      coverUrl: coverEntry
        ? async () => URL.createObjectURL(await coverEntry.async("blob"))
        : undefined,
    };
  }

  // ---------- RTF (flow) ----------
  async function loadRtf(file) {
    const raw = await file.text();
    const text = rtfToText(raw);
    const html = text.split(/\n{2,}/).map(p => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
    return { kind: "flow", html: `<section class="chapter">${html}</section>` };
  }

  function rtfToText(rtf) {
    // Minimal RTF stripper: drops control words/groups, keeps plain text.
    // Handles \par / \line as breaks and common escaped chars.
    let out = "";
    let i = 0;
    const n = rtf.length;
    let skipDepth = 0;
    while (i < n) {
      const c = rtf[i];
      if (c === "\\") {
        const word = /^\\([a-zA-Z]+)(-?\d+)?\s?/.exec(rtf.slice(i));
        if (word) {
          const tag = word[1];
          if (tag === "par" || tag === "line") out += "\n";
          i += word[0].length;
          continue;
        }
        if (rtf[i + 1] === "'") { i += 4; continue; } // \'xx hex escape, skip (best effort)
        if (rtf[i + 1] === "\\" || rtf[i + 1] === "{" || rtf[i + 1] === "}") { out += rtf[i + 1]; i += 2; continue; }
        i++;
        continue;
      }
      if (c === "{" || c === "}") { i++; continue; }
      out += c;
      i++;
    }
    return out.replace(/[ \t]+\n/g, "\n").trim();
  }

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function sanitizeFlowHtml(markup) {
    const doc = new DOMParser().parseFromString(markup, "text/html");
    doc.querySelectorAll("script,style,iframe,object,embed,link,meta,base,form").forEach((el) => el.remove());
    doc.querySelectorAll("*").forEach((el) => {
      for (const attr of Array.from(el.attributes)) {
        const value = attr.value.trim();
        if (/^on/i.test(attr.name) || (/^(href|src|xlink:href)$/i.test(attr.name) && /^javascript:/i.test(value))) {
          el.removeAttribute(attr.name);
        }
      }
    });
    return doc.body.innerHTML;
  }

  async function loadText(file) {
    const text = await file.text();
    const html = text.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
    return { kind: "flow", html: `<section class="chapter">${html}</section>` };
  }

  async function loadHtml(file) {
    return { kind: "flow", html: `<section class="chapter">${sanitizeFlowHtml(await file.text())}</section>` };
  }

  async function loadMarkdown(file) {
    const lines = (await file.text()).replace(/\r/g, "").split("\n");
    let html = "", paragraph = [];
    const flush = () => {
      if (!paragraph.length) return;
      html += `<p>${paragraph.join(" ")}</p>`;
      paragraph = [];
    };
    for (const raw of lines) {
      const line = escapeHtml(raw.trim());
      const heading = /^(#{1,6})\s+(.+)$/.exec(line);
      if (heading) { flush(); const level = heading[1].length; html += `<h${level}>${heading[2]}</h${level}>`; }
      else if (!line) flush();
      else paragraph.push(line.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>"));
    }
    flush();
    return { kind: "flow", html: `<section class="chapter">${html}</section>` };
  }

  async function loadSingleImage(file) {
    const url = URL.createObjectURL(file);
    return { kind: "paged", pageCount: 1, async getPageUrl() { return url; }, async coverUrl() { return url; } };
  }

  async function loadStructuredText(file, type) {
    let text = await file.text();
    if (type === "json") {
      try { text = JSON.stringify(JSON.parse(text), null, 2); } catch (_) { /* show malformed JSON as supplied */ }
    }
    return { kind: "flow", html: `<section class="chapter"><h2>${escapeHtml(file.name)}</h2><pre class="document-code">${escapeHtml(text)}</pre></section>` };
  }

  async function loadDelimited(file, separator) {
    const rows = (await file.text()).replace(/\r/g, "").split("\n").filter(Boolean).map((line) => line.split(separator));
    const html = `<table class="document-table">${rows.map((row, i) => `<tr>${row.map((cell) => `<${i ? "td" : "th"}>${escapeHtml(cell)}</${i ? "td" : "th"}>`).join("")}</tr>`).join("")}</table>`;
    return { kind: "flow", html: `<section class="chapter">${html}</section>` };
  }

  function xmlText(node, localName) {
    return Array.from(node.getElementsByTagName("*")).find((el) => el.localName === localName)?.textContent?.trim() || "";
  }

  async function loadDocx(file) {
    const zip = await JSZip.loadAsync(file);
    const entry = zip.file("word/document.xml");
    if (!entry) throw new Error("This DOCX is missing word/document.xml.");
    const doc = parseXml(await entry.async("text"), "DOCX document.xml");
    const blocks = [];
    for (const node of Array.from(doc.getElementsByTagName("*")).filter((el) => ["p", "tbl"].includes(el.localName))) {
      if (node.localName === "p" && node.parentElement?.localName !== "tc") {
        const text = Array.from(node.getElementsByTagName("*")).filter((el) => el.localName === "t").map((el) => el.textContent).join("");
        if (!text.trim()) continue;
        const style = Array.from(node.getElementsByTagName("*")).find((el) => el.localName === "pStyle")?.getAttribute("w:val") || "";
        const heading = /heading\s*([1-6])/i.exec(style);
        blocks.push(heading ? `<h${heading[1]}>${escapeHtml(text)}</h${heading[1]}>` : `<p>${escapeHtml(text)}</p>`);
      } else if (node.localName === "tbl" && node.parentElement?.localName !== "tc") {
        const rows = Array.from(node.children).filter((el) => el.localName === "tr");
        blocks.push(`<table class="document-table">${rows.map((row) => `<tr>${Array.from(row.children).filter((el) => el.localName === "tc").map((cell) => `<td>${escapeHtml(cell.textContent.trim())}</td>`).join("")}</tr>`).join("")}</table>`);
      }
    }
    const core = zip.file("docProps/core.xml");
    const title = core ? xmlText(parseXml(await core.async("text"), "DOCX core.xml"), "title") : "";
    return { kind: "flow", html: `<section class="chapter">${blocks.join("")}</section>`, title: title || undefined };
  }

  async function loadOdt(file) {
    const zip = await JSZip.loadAsync(file);
    const entry = zip.file("content.xml");
    if (!entry) throw new Error("This ODT is missing content.xml.");
    const doc = parseXml(await entry.async("text"), "ODT content.xml");
    const out = [];
    for (const el of Array.from(doc.getElementsByTagName("*")).filter((node) => ["h", "p"].includes(node.localName))) {
      if (el.closest?.("table")) continue;
      const text = el.textContent.trim();
      if (!text) continue;
      if (el.localName === "h") {
        const level = Math.max(1, Math.min(6, Number(el.getAttribute("text:outline-level") || 2)));
        out.push(`<h${level}>${escapeHtml(text)}</h${level}>`);
      } else out.push(`<p>${escapeHtml(text)}</p>`);
    }
    const meta = zip.file("meta.xml");
    const title = meta ? xmlText(parseXml(await meta.async("text"), "ODT meta.xml"), "title") : "";
    return { kind: "flow", html: `<section class="chapter">${out.join("")}</section>`, title: title || undefined };
  }

  function renderFb2Node(node, images) {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.nodeValue || "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const name = node.localName;
    const children = () => Array.from(node.childNodes).map((child) => renderFb2Node(child, images)).join("");
    const tags = { section: "section", title: "h2", subtitle: "h3", p: "p", emphasis: "em", strong: "strong", poem: "blockquote", epigraph: "blockquote", cite: "footer", stanza: "div", v: "p" };
    if (name === "empty-line") return "<br>";
    if (name === "image") {
      const id = (node.getAttribute("l:href") || node.getAttribute("xlink:href") || node.getAttribute("href") || "").replace(/^#/, "");
      return images[id] ? `<img src="${images[id]}" alt="">` : "";
    }
    const tag = tags[name];
    return tag ? `<${tag}>${children()}</${tag}>` : children();
  }

  async function loadFb2(file) {
    const doc = parseXml(await file.text(), "FB2 document");
    const images = {};
    for (const binary of Array.from(doc.getElementsByTagName("*")).filter((el) => el.localName === "binary")) {
      try {
        const bytes = Uint8Array.from(atob(binary.textContent.replace(/\s/g, "")), (c) => c.charCodeAt(0));
        images[binary.getAttribute("id")] = URL.createObjectURL(new Blob([bytes], { type: binary.getAttribute("content-type") || "image/jpeg" }));
      } catch (_) { /* skip a malformed embedded image */ }
    }
    const bodies = Array.from(doc.getElementsByTagName("*")).filter((el) => el.localName === "body");
    const html = bodies.map((body) => `<section class="chapter">${renderFb2Node(body, images)}</section>`).join("");
    if (!html.trim()) throw new Error("This FB2 has no readable body.");
    const title = xmlText(doc, "book-title");
    return { kind: "flow", html, title: title || undefined };
  }

  // Ordinary ZIP files are import containers when they contain readable
  // documents. Repeated extensions, mixed types and nested ZIPs are retained.
  async function expandImport(file, depth = 0) {
    if (extOf(file.name) !== "zip" || depth > 3) return { files: [file], ignored: [] };
    let zip;
    try { zip = await JSZip.loadAsync(file); } catch (_) { return { files: [file], ignored: [] }; }
    const entries = Object.values(zip.files).filter((entry) => !entry.dir);
    const readable = entries.filter((entry) => IMPORTABLE_EXTENSIONS.has(extOf(entry.name)));
    const documents = readable.filter((entry) => !IMAGE_RE.test(entry.name));
    if (!documents.length) {
      const images = entries.filter((entry) => IMAGE_RE.test(entry.name));
      return images.length
        ? { files: [file], ignored: entries.filter((entry) => !IMAGE_RE.test(entry.name)).map((entry) => entry.name) }
        : { files: [], ignored: entries.map((entry) => entry.name) };
    }

    const files = [];
    const ignored = entries.filter((entry) => !IMPORTABLE_EXTENSIONS.has(extOf(entry.name))).map((entry) => entry.name);
    for (const entry of readable) {
      const blob = await entry.async("blob");
      const safeName = entry.name.replace(/^\/+/, "").replace(/\//g, " — ");
      const child = new File([blob], safeName, { type: blob.type, lastModified: file.lastModified || Date.now() });
      if (extOf(child.name) === "zip") {
        const nested = await expandImport(child, depth + 1);
        files.push(...nested.files); ignored.push(...nested.ignored);
      } else files.push(child);
    }
    return { files, ignored };
  }

  // ---------- MOBI (best-effort, DRM-free only, flow) ----------
  async function loadMobi(file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    if (buf.length < 86) throw new Error("This Palm/MOBI file is too small or damaged.");
    const dv = new DataView(buf.buffer);

    const numRecords = dv.getUint16(76);
    const recInfo = [];
    for (let r = 0; r < numRecords; r++) {
      const off = 78 + r * 8;
      if (off + 4 > buf.length) throw new Error("This Palm/MOBI record table is damaged.");
      recInfo.push({ offset: dv.getUint32(off) });
    }
    if (!recInfo.length || recInfo[0].offset >= buf.length) throw new Error("This Palm/MOBI file has no readable records.");
    const recEnd = (idx) => idx + 1 < recInfo.length ? recInfo[idx + 1].offset : buf.length;
    const rec0 = buf.subarray(recInfo[0].offset, recEnd(0));
    const rec0dv = new DataView(rec0.buffer, rec0.byteOffset, rec0.byteLength);
    const compression = rec0dv.getUint16(0);
    const encryption = rec0dv.getUint16(12);
    if (encryption !== 0) {
      throw new Error("This MOBI file is DRM-protected. DRM-locked books can't be opened by any browser-based reader.");
    }
    const recordCount = rec0dv.getUint16(8);
    const firstContentRecord = 1;

    function decompressPalmDoc(data) {
      const out = [];
      let i = 0;
      while (i < data.length) {
        const b = data[i++];
        if (b === 0) { out.push(0); }
        else if (b <= 8) { for (let k = 0; k < b; k++) out.push(data[i++]); }
        else if (b <= 0x7f) { out.push(b); }
        else if (b >= 0xc0) { out.push(32, b ^ 0x80); }
        else {
          const b2 = data[i++];
          const bothBytes = (b << 8) | b2;
          const distance = (bothBytes >> 3) & 0x7ff;
          const length = (bothBytes & 0x7) + 3;
          const start = out.length - distance;
          for (let k = 0; k < length; k++) out.push(out[start + k]);
        }
      }
      return out;
    }

    let bytes = [];
    const lastContentRecord = Math.min(recordCount, recInfo.length - 1);
    for (let r = firstContentRecord; r <= lastContentRecord; r++) {
      const raw = buf.subarray(recInfo[r].offset, recEnd(r));
      const decoded = compression === 2 ? decompressPalmDoc(raw) : Array.from(raw);
      bytes = bytes.concat(decoded);
    }
    const html = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
    return { kind: "flow", html: html.replace(/<\/?(html|head|body)[^>]*>/gi, "") };
  }

  // ---------- Router ----------
  async function load(file) {
    const ext = extOf(file.name);
    switch (ext) {
      case "cbz": case "zip":
        return loadImageArchive(file);
      case "cbt":
        return loadTarImageArchive(file);
      case "pdf":
        return loadPdf(file);
      case "epub":
        return loadEpub(file);
      case "rtf":
        return loadRtf(file);
      case "mobi":
        return loadMobi(file);
      case "txt": case "text": case "log":
        return loadText(file);
      case "html": case "htm": case "xhtml":
        return loadHtml(file);
      case "md": case "markdown":
        return loadMarkdown(file);
      case "fb2":
        return loadFb2(file);
      case "docx":
        return loadDocx(file);
      case "odt":
        return loadOdt(file);
      case "pdb": case "prc":
        return loadMobi(file);
      case "json": case "xml": case "opf":
        return loadStructuredText(file, ext);
      case "csv":
        return loadDelimited(file, ",");
      case "tsv":
        return loadDelimited(file, "\t");
      case "jpg": case "jpeg": case "png": case "gif": case "webp": case "avif": case "bmp": case "svg":
        return loadSingleImage(file);
      case "cbr": case "cb7": case "7z": case "rar":
        throw new Error(`.${ext} needs a RAR/7z decoder that isn't bundled in this build yet — re-save as .cbz/.zip for now.`);
      case "iba":
        throw new Error("iBooks Author (.iba) files are a proprietary Apple format, usually DRM-protected, with no public spec. No web app — including this one — can open them. Try exporting/printing to PDF from the Books app instead.");
      case "mobi8": case "azw": case "azw3":
        throw new Error("Modern Kindle formats (AZW/AZW3) are typically DRM-protected and aren't supported. DRM-free classic .mobi files are supported.");
      default:
        throw new Error(`Unrecognized file type ".${ext}".`);
    }
  }

  return { load, extOf, expandImport, importableExtensions: IMPORTABLE_EXTENSIONS };
})();
