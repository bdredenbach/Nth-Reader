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

  async function runDiagnostics(force = false) {
    if (diagnosticPromise && !force) return diagnosticPromise;
    diagnosticPromise = (async () => {
      const result = {
        manifestOk: false,
        manifestUrl: "",
        controlled: Boolean(navigator.serviceWorker?.controller),
        workerState: "not registered",
        workerVersion: "unknown",
      };

      const manifestLink = document.querySelector('link[rel="manifest"]');
      if (manifestLink) {
        result.manifestUrl = new URL(manifestLink.href, location.href).pathname;
        try {
          const response = await fetch(manifestLink.href, { cache: "no-store" });
          const manifest = response.ok ? await response.json() : null;
          const iconSizes = new Set((manifest?.icons || []).flatMap((icon) => String(icon.sizes || "").split(/\s+/)));
          result.manifestOk = Boolean(
            response.ok &&
            (manifest?.name || manifest?.short_name) &&
            manifest?.start_url &&
            ["fullscreen", "standalone", "minimal-ui", "window-controls-overlay"].includes(manifest?.display) &&
            iconSizes.has("192x192") &&
            iconSizes.has("512x512") &&
            manifest?.prefer_related_applications !== true
          );
        } catch (error) {
          result.manifestError = error?.message || String(error);
        }
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
        "<br>" + statusLine(Boolean(diagnostic?.manifestOk), "Manifest and required icons validated", "Manifest validation is still running");
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
      statusLine(Boolean(diagnostic?.manifestOk), "Manifest and required icons validated", "Checking the web app manifest") +
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
