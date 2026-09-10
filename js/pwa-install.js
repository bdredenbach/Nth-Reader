/* Nth Reader — guided PWA installation */
(function () {
  const installButton = document.getElementById("menu-install-btn");
  const overlay = document.getElementById("install-overlay");
  const panel = document.getElementById("install-panel");
  const message = document.getElementById("install-message");
  const readiness = document.getElementById("install-readiness");
  const primary = document.getElementById("install-primary-btn");
  const close = document.getElementById("install-close-btn");
  let installPrompt = window.__nthInstallPrompt || null;
  let diagnostic = null;
  let diagnosticPromise = null;
  const manifestUrl = window.__nthManifestUrl || "./manifest.webmanifest?v=0.25.01";

  function ensureManifestLink() {
    if (typeof window.__nthEnsureManifestLink === "function") {
      return window.__nthEnsureManifestLink();
    }
    let link = document.querySelector('link[rel~="manifest"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "manifest";
      document.head.appendChild(link);
      window.__nthManifestLinkWasRepaired = true;
    }
    const wanted = new URL(manifestUrl, location.href).href;
    if (link.href !== wanted) link.href = wanted;
    return link;
  }

  ensureManifestLink();

  const standalone = () =>
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
  const chromeAndroid = () => /android/i.test(navigator.userAgent) && /chrome/i.test(navigator.userAgent);

  function setOpen(open) {
    overlay.hidden = !open;
    panel.hidden = !open;
    if (open) {
      updateGuide();
      runDiagnostics().then(updateGuide);
    }
  }

  function statusLine(ok, readyText, waitingText) {
    return `<span class="${ok ? "install-ready" : "install-waiting"}">${ok ? "✓" : "○"} ${ok ? readyText : waitingText}</span>`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function inspectIcon(manifest, manifestUrl, wantedSize) {
    const declaration = (manifest?.icons || []).find((icon) =>
      String(icon.sizes || "").split(/\s+/).includes(wantedSize)
    );
    const result = {
      declared: Boolean(declaration?.src),
      status: 0,
      contentType: "",
      ok: false,
    };
    if (!declaration?.src) return result;
    try {
      const iconUrl = new URL(declaration.src, manifestUrl);
      const response = await fetch(iconUrl, { cache: "no-store" });
      result.status = response.status;
      result.contentType = response.headers.get("content-type") || "";
      result.ok = response.ok && result.contentType.toLowerCase().startsWith("image/");
    } catch (error) {
      result.error = error?.message || String(error);
    }
    return result;
  }

  async function runDiagnostics(force = false) {
    if (diagnosticPromise && !force) return diagnosticPromise;
    diagnosticPromise = (async () => {
      const result = {
        manifestOk: false,
        manifestUrl: "",
        manifest: null,
        manifestLinkRepaired: Boolean(window.__nthManifestLinkWasRepaired),
        controlled: Boolean(navigator.serviceWorker?.controller),
        workerState: "not registered",
        workerVersion: "unknown",
      };

      const manifestLink = ensureManifestLink();
      if (manifestLink) {
        result.manifestUrl = new URL(manifestLink.href, location.href).href;
        try {
          const response = await fetch(manifestLink.href, { cache: "no-store" });
          const contentType = response.headers.get("content-type") || "";
          let manifest = null;
          let parseError = "";
          try {
            manifest = await response.json();
          } catch (error) {
            parseError = error?.message || String(error);
          }
          const [icon192, icon512] = manifest
            ? await Promise.all([
              inspectIcon(manifest, manifestLink.href, "192x192"),
              inspectIcon(manifest, manifestLink.href, "512x512"),
            ])
            : [{ ok: false }, { ok: false }];
          const details = {
            status: response.status,
            responseOk: response.ok,
            contentType,
            contentTypeOk: /(?:application\/(?:manifest\+json|json)|text\/json)/i.test(contentType),
            parsed: Boolean(manifest),
            parseError,
            name: manifest?.name || manifest?.short_name || "",
            nameOk: Boolean(manifest?.name || manifest?.short_name),
            startUrl: manifest?.start_url || "",
            startUrlOk: Boolean(manifest?.start_url),
            display: manifest?.display || "",
            displayOk: ["fullscreen", "standalone", "minimal-ui", "window-controls-overlay"].includes(manifest?.display),
            relatedOk: manifest?.prefer_related_applications !== true,
            icon192,
            icon512,
          };
          result.manifest = details;
          result.manifestOk = Boolean(
            details.responseOk &&
            details.contentTypeOk &&
            details.parsed &&
            details.nameOk &&
            details.startUrlOk &&
            details.displayOk &&
            details.relatedOk &&
            details.icon192.ok &&
            details.icon512.ok
          );
        } catch (error) {
          result.manifestError = error?.message || String(error);
        }
      } else {
        result.manifestError = "No rel=manifest link was found in the page.";
      }

      if ("serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration("./");
          result.workerState = registration?.active?.state || registration?.waiting?.state || registration?.installing?.state || "not registered";
          result.controlled = Boolean(navigator.serviceWorker.controller);
          if (force) await registration?.update();
          result.workerVersion = await getWorkerVersion();
        } catch (error) {
          result.workerState = `error: ${error?.message || error}`;
        }
      }

      diagnostic = result;
      return result;
    })().finally(() => {
      diagnosticPromise = null;
    });
    return diagnosticPromise;
  }

  function manifestReport() {
    if (!diagnostic) return statusLine(false, "", "Running manifest checks");
    if (!diagnostic.manifest) {
      return statusLine(false, "", `Manifest request failed: ${escapeHtml(diagnostic.manifestError || "unknown error")}`);
    }
    const item = diagnostic.manifest;
    const iconSummary = (icon, size) => {
      const detail = icon?.status
        ? `${size} icon: HTTP ${icon.status} ${icon.contentType || "unknown type"}`
        : `${size} icon is not declared or could not be fetched${icon?.error ? `: ${icon.error}` : ""}`;
      return statusLine(Boolean(icon?.ok), escapeHtml(detail), escapeHtml(detail));
    };
    const rows = [
      statusLine(true, diagnostic.manifestLinkRepaired ? "Manifest link repaired during page load" : "Manifest link present in page", ""),
      statusLine(item.responseOk, `Manifest HTTP ${item.status}`, `Manifest HTTP ${item.status || "failed"}`),
      statusLine(item.contentTypeOk, `Manifest type: ${escapeHtml(item.contentType)}`, `Unexpected manifest type: ${escapeHtml(item.contentType || "missing")}`),
      statusLine(item.parsed, "Manifest JSON parsed", `Manifest JSON failed${item.parseError ? `: ${escapeHtml(item.parseError)}` : ""}`),
      statusLine(item.nameOk, `App name: ${escapeHtml(item.name)}`, "App name is missing"),
      statusLine(item.startUrlOk, `Start URL: ${escapeHtml(item.startUrl)}`, "Start URL is missing"),
      statusLine(item.displayOk, `Display: ${escapeHtml(item.display)}`, `Unsupported display: ${escapeHtml(item.display || "missing")}`),
      statusLine(item.relatedOk, "Related-app preference allows PWA installation", "prefer_related_applications blocks PWA installation"),
      iconSummary(item.icon192, "192×192"),
      iconSummary(item.icon512, "512×512"),
    ];
    rows.unshift(statusLine(diagnostic.manifestOk, "Manifest passed every app-side check", "Manifest failed one or more checks"));
    return rows.join("<br>");
  }

  function getWorkerVersion() {
    return new Promise((resolve) => {
      const controller = navigator.serviceWorker?.controller;
      if (!controller) return resolve("no controller");
      const timeout = setTimeout(() => {
        navigator.serviceWorker.removeEventListener("message", onMessage);
        resolve("no version reply");
      }, 1200);
      function onMessage(event) {
        if (!event.data?.version) return;
        clearTimeout(timeout);
        navigator.serviceWorker.removeEventListener("message", onMessage);
        resolve(event.data.version);
      }
      navigator.serviceWorker.addEventListener("message", onMessage);
      controller.postMessage("GET_VERSION");
    });
  }

  function updateGuide() {
    if (standalone()) {
      installButton.hidden = true;
      message.textContent = "Nth Reader is already installed on this device.";
      readiness.innerHTML = '<span class="install-ready">✓ Installed and running as an app</span>';
      primary.hidden = true;
      return;
    }

    if (installPrompt) {
      message.textContent = "Everything is ready. Install Nth Reader as its own app.";
      readiness.innerHTML = statusLine(true, "Chrome installation prompt received", "") +
        "<br>" + statusLine(Boolean(diagnostic?.controlled), "Offline reader is controlling this page", "Offline reader is not controlling this page yet") +
        "<br>" + manifestReport();
      primary.textContent = "Install Now";
      primary.hidden = false;
      return;
    }

    if (ios()) {
      message.textContent = "Safari handles installation from its Share menu.";
      readiness.innerHTML = 'Tap <strong>Share</strong>, then choose <strong>Add to Home Screen</strong>.';
      primary.hidden = true;
      return;
    }

    const controlled = Boolean(diagnostic?.controlled);
    message.textContent = "Chrome has not offered native app installation on this visit.";
    readiness.innerHTML =
      manifestReport() +
      "<br>" + statusLine(controlled, "Offline reader is controlling this page", "Offline reader is not controlling this page yet") +
      `<br><small>Worker: ${diagnostic?.workerVersion || "checking…"} (${diagnostic?.workerState || "checking…"})</small>` +
      "<br>" + statusLine(false, "", "Native installation prompt not received") +
      (chromeAndroid()
        ? '<br><small>Chrome menu → <strong>Install and create shortcut</strong>. If Chrome only offers <strong>Create shortcut</strong>, it still considers this page a website rather than an installable app.</small>'
        : '<br><small>Use your browser menu to check for an Install or Add to Home Screen command.</small>');
    primary.textContent = controlled ? "Run Install Check" : "Finish Offline Setup";
    primary.hidden = false;
  }

  async function requestInstall() {
    if (installPrompt) {
      primary.disabled = true;
      await installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      window.__nthInstallPrompt = null;
      primary.disabled = false;
      updateGuide();
      return;
    }

    if ("serviceWorker" in navigator && !navigator.serviceWorker.controller) {
      sessionStorage.setItem("nth-open-install-guide", "1");
      message.textContent = "Finishing the one-time offline setup…";
      await navigator.serviceWorker.ready.catch(() => null);
      location.reload();
      return;
    }

    primary.disabled = true;
    message.textContent = "Refreshing the manifest and offline-reader checks…";
    await runDiagnostics(true);
    primary.disabled = false;
    updateGuide();
  }

  function captureInstallPrompt(event) {
    const captured = event || window.__nthInstallPrompt;
    if (!captured) return;
    captured.preventDefault?.();
    installPrompt = captured;
    window.__nthInstallPrompt = captured;
    installButton.hidden = false;
    installButton.textContent = "⬇ Install Nth Reader";
    if (!panel.hidden) updateGuide();
  }

  // The head listener catches early events; these cover later events and the
  // custom notification dispatched by that listener.
  window.addEventListener("beforeinstallprompt", captureInstallPrompt);
  window.addEventListener("nth:installprompt-ready", () => captureInstallPrompt());
  captureInstallPrompt();

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    window.__nthInstallPrompt = null;
    installButton.hidden = true;
    setOpen(false);
  });

  installButton.addEventListener("click", () => {
    if (installPrompt) requestInstall();
    else setOpen(true);
  });
  primary.addEventListener("click", requestInstall);
  close.addEventListener("click", () => setOpen(false));
  overlay.addEventListener("click", () => setOpen(false));

  if (standalone()) installButton.hidden = true;
  runDiagnostics().then(updateGuide);
  if (sessionStorage.getItem("nth-open-install-guide") === "1") {
    sessionStorage.removeItem("nth-open-install-guide");
    window.addEventListener("load", () => setOpen(true), { once: true });
  }
})();
