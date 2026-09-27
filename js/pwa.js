let deferredPrompt = null;

export function initPwa() {
  const installBtn = document.getElementById("install-pwa");
  const hint = document.getElementById("install-hint");
  if (!installBtn) return;

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
    });
  }

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;

  if (standalone) {
    installBtn.hidden = true;
    if (hint) {
      hint.hidden = false;
      hint.textContent = "App instalada en este dispositivo.";
    }
    return;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    installBtn.hidden = false;
    if (hint) hint.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installBtn.hidden = true;
    if (hint) {
      hint.hidden = false;
      hint.textContent = "App instalada.";
    }
  });

  installBtn.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      return;
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (hint) {
      hint.hidden = false;
      hint.textContent = ios
        ? "En Safari: Compartir → Agregar a pantalla de inicio."
        : "En el menú del navegador: Instalar app / Agregar a pantalla de inicio.";
    }
  });
}
