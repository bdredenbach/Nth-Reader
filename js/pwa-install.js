/* Nth Reader — guided PWA installation */
(function () {
  const installButton = document.getElementById("menu-install-btn");
  const overlay = document.getElementById("install-overlay");
  const panel = document.getElementById("install-panel");
  const message = document.getElementById("install-message");
  const readiness = document.getElementById("install-readiness");
  const primary = document.getElementById("install-primary-btn");
  const close = document.getElementById("install-close-btn");
  const startedAt = Date.now();
  let installPrompt = window.__nthInstallPrompt || null;
  let timer = null;

  const standalone = () =>
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
  const ios = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
  const chromeAndroid = () => /android/i.test(navigator.userAgent) && /chrome/i.test(navigator.userAgent);

  function setOpen(open) {
    overlay.hidden = !open;
    panel.hidden = !open;
    if (open) {
      updateGuide();
      clearInterval(timer);
      timer = setInterval(updateGuide, 1000);
    } else {
      clearInterval(timer);
      timer = null;
    }
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
      readiness.innerHTML = '<span class="install-ready">✓ Chrome installation is ready</span><br>✓ Offline reader is registered<br>✓ App icons and manifest are available';
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

    const controlled = "serviceWorker" in navigator && Boolean(navigator.serviceWorker.controller);
    const remaining = Math.max(0, 30 - Math.floor((Date.now() - startedAt) / 1000));
    message.textContent = chromeAndroid()
      ? "Chrome is preparing the native app installation."
      : "Your browser has not exposed its native install prompt yet.";
    readiness.innerHTML = `${controlled ? '<span class="install-ready">✓ Offline reader is active</span>' : '<span class="install-waiting">○ One-time offline setup needs finishing</span>'}<br>` +
      (remaining
        ? `<span class="install-waiting">○ Keep this page open for ${remaining} more second${remaining === 1 ? "" : "s"}</span>`
        : '<span class="install-ready">✓ 30-second visit completed</span>') +
      '<br>✓ Install listener active since page startup' +
      '<br>✓ Tap or use the shelf at least once' +
      '<br><small>If an older Nth Reader shortcut already exists, remove it before trying again.</small>';
    primary.textContent = controlled ? "Check Again" : "Finish Setup";
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
  if (sessionStorage.getItem("nth-open-install-guide") === "1") {
    sessionStorage.removeItem("nth-open-install-guide");
    window.addEventListener("load", () => setOpen(true), { once: true });
  }
})();
