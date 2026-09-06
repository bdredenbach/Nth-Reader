/* Nth Reader — formats.js
 * Turns a source File/Blob into a normalized book object:
 *   { kind: "paged", pageCount, getPageUrl(i) }   -- image-per-page, drives the corner page-turn
 *   { kind: "flow",  html }                        -- reflowable text, drives the column paginator
 *
 * Supported now:
 *   CBZ / ZIP / CBT (paged, images in a zip)   -- via JSZip
 *   PDF                                         -- via pdf.js, rasterized to canvas per page
 *   EPUB                                        -- via JSZip, spine chapters concatenated to flow html
 *   RTF                                         -- minimal RTF -> text/html, flow
 *   MOBI (unencrypted / DRM-free only)          -- best-effort PalmDOC decompression, flow
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

  const IMAGE_RE = /\.(jpe?g|png|gif|webp|avif|bmp)$/i;

  // ---------- CBZ / ZIP / CBT (image archive) ----------
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
    return {
      kind: "paged",
      pageCount: entries.length,
      getPageUrl,
      async coverUrl() { return getPageUrl(0); },
    };
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
    return {
      kind: "paged",
      pageCount: pdf.numPages,
      getPageUrl,
      async coverUrl() { return getPageUrl(0); },
    };
  }

  // ---------- EPUB (flow) ----------
  async function loadEpub(file) {
    const zip = await JSZip.loadAsync(file);
    const containerXml = await zip.file("META-INF/container.xml").async("text");
    const containerDoc = new DOMParser().parseFromString(containerXml, "application/xml");
    const opfPath = containerDoc.querySelector("rootfile").getAttribute("full-path");
    const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
    const opfXml = await zip.file(opfPath).async("text");
    const opfDoc = new DOMParser().parseFromString(opfXml, "application/xml");

    const manifest = {};
    opfDoc.querySelectorAll("manifest > item").forEach(item => {
      manifest[item.getAttribute("id")] = opfDir + item.getAttribute("href");
    });
    const spineIds = Array.from(opfDoc.querySelectorAll("spine > itemref")).map(r => r.getAttribute("idref"));
    const title = opfDoc.querySelector("metadata > title")?.textContent?.trim();

    let html = "";
    for (const id of spineIds) {
      const path = manifest[id];
      if (!path || !zip.file(path)) continue;
      const chapterXml = await zip.file(path).async("text");
      const doc = new DOMParser().parseFromString(chapterXml, "application/xhtml+xml");
      const body = doc.querySelector("body");
      if (body) html += `<section class="chapter">${body.innerHTML}</section>`;
    }
    // Inline images so they survive outside the zip context.
    const imgEls = Array.from(new DOMParser().parseFromString(html, "text/html").images);
    let container = document.createElement("div");
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
    return { kind: "flow", html: container.innerHTML, title };
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

  // ---------- MOBI (best-effort, DRM-free only, flow) ----------
  async function loadMobi(file) {
    const buf = new Uint8Array(await file.arrayBuffer());
    const dv = new DataView(buf.buffer);

    const numRecords = dv.getUint16(76);
    const recInfo = [];
    for (let r = 0; r < numRecords; r++) {
      const off = 78 + r * 8;
      recInfo.push({ offset: dv.getUint32(off) });
    }
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
    for (let r = firstContentRecord; r <= recordCount; r++) {
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
      case "cbz": case "zip": case "cbt":
        return loadImageArchive(file);
      case "pdf":
        return loadPdf(file);
      case "epub":
        return loadEpub(file);
      case "rtf":
        return loadRtf(file);
      case "mobi":
        return loadMobi(file);
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

  return { load, extOf };
})();
