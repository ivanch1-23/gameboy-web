let deferredPrompt = null;

function setHint(hint, text) {
  if (!hint) return;
  hint.hidden = false;
  hint.textContent = text;
}

function updateNetStatus() {
  const el = document.getElementById("net-status");
  if (!el) return;
  const online = navigator.onLine !== false;
  el.hidden = false;
  el.classList.toggle("is-offline", !online);
  el.textContent = online
    ? "Offline listo: Tetris, Snake y las ROMs ya guardadas en este teléfono."
    : "Sin internet. Podés seguir jugando con lo que ya está en el teléfono.";
}

export function initPwa() {
  const installBtn = document.getElementById("install-pwa");
  const hint = document.getElementById("install-hint");
  updateNetStatus();
  window.addEventListener("online", updateNetStatus);
  window.addEventListener("offline", updateNetStatus);

  if (navigator.storage?.persist) {
    navigator.storage.persist().catch(() => {});
  }

  if ("serviceWorker" in navigator) {
    const register = () => navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register);
  }

  if (!installBtn) return;

  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;

  if (standalone) {
    installBtn.hidden = true;
    setHint(hint, "App instalada. Abrila una vez con internet y después funciona sin señal.");
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
    setHint(hint, "App instalada. Abrila una vez con internet y después funciona sin señal.");
  });

  installBtn.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      return;
    }
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setHint(
      hint,
      ios
        ? "En Safari: Compartir → Agregar a pantalla de inicio. Abrila una vez con internet."
        : "En el menú del navegador: Instalar app / Agregar a pantalla de inicio."
    );
  });
}
