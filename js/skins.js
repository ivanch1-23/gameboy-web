export const SKINS = [
  { id: "dmg", name: "Classic DMG", swatch: "linear-gradient(#d7de62,#9aa83a)" },
  { id: "mario", name: "Mario", swatch: "linear-gradient(#e52521,#0b3d91)" },
  { id: "luigi", name: "Luigi", swatch: "linear-gradient(#43b047,#1d3f9a)" },
  { id: "wario", name: "Wario", swatch: "linear-gradient(#f5c400,#6b2fa0)" },
  { id: "waluigi", name: "Waluigi", swatch: "linear-gradient(#6a2db5,#f5c400)" },
  { id: "peach", name: "Peach", swatch: "linear-gradient(#ff9ec8,#e6c35c)" },
  { id: "bowser", name: "Bowser", swatch: "linear-gradient(#c45a12,#2a8a2a)" },
  { id: "yoshi", name: "Yoshi", swatch: "linear-gradient(#58c040,#e23a3a)" },
  { id: "toad", name: "Toad", swatch: "linear-gradient(#fff,#e02030)" },
  { id: "spidey", name: "Spider-Man", swatch: "linear-gradient(#e10600,#0022aa)" },
  { id: "venom", name: "Venom", swatch: "linear-gradient(#111,#8aff8a)" },
  { id: "shrek", name: "Shrek", swatch: "linear-gradient(#6e8b2c,#6a3a14)" },
  { id: "fiona", name: "Fiona", swatch: "linear-gradient(#9ab83a,#c06080)" },
  { id: "dk", name: "Donkey Kong", swatch: "linear-gradient(#5a2c14,#e02020)" },
  { id: "pikachu", name: "Pikachu", swatch: "linear-gradient(#ffd000,#e02020)" },
  { id: "batman", name: "Batman", swatch: "linear-gradient(#121216,#f5c400)" },
  { id: "sonic", name: "Sonic", swatch: "linear-gradient(#1d6dff,#e02030)" },
  { id: "kirby", name: "Kirby", swatch: "linear-gradient(#ff9ec8,#fff)" },
  { id: "link", name: "Link", swatch: "linear-gradient(#3d7a28,#c4a05a)" },
  { id: "spongebob", name: "Bob Esponja", swatch: "linear-gradient(#f5e022,#3a7ad6)" },
  { id: "loudred", name: "Play It Loud", swatch: "linear-gradient(#d20e28,#111)" },
];

const SCALES = [0.7, 0.85, 1, 1.15, 1.32];
const EXPAND_SCALE = 1.32;

function loadState() {
  const skin = localStorage.getItem("gb.skin") || "dmg";
  const scale = Number(localStorage.getItem("gb.scale") || 0.85);
  const expanded = localStorage.getItem("gb.expanded") === "1";
  return { skin, scale, expanded };
}

function saveState(state) {
  localStorage.setItem("gb.skin", state.skin);
  localStorage.setItem("gb.scale", String(state.scale));
  localStorage.setItem("gb.expanded", state.expanded ? "1" : "0");
}

export function initShells({ audio } = {}) {
  const gb = document.getElementById("gb");
  const label = document.getElementById("skin-label");
  const grid = document.getElementById("skin-grid");
  const hint = document.getElementById("size-hint");
  const expandBtn = document.getElementById("size-expand");
  const badge = document.getElementById("shell-badge");
  const state = loadState();

  function nearestScale(value) {
    return SCALES.reduce((best, s) =>
      Math.abs(s - value) < Math.abs(best - value) ? s : best
    );
  }

  state.scale = nearestScale(state.scale);

  function apply() {
    document.body.dataset.skin = state.skin;
    gb.dataset.skin = state.skin;
    gb.style.setProperty("--gb-scale", String(state.scale));
    document.body.classList.toggle("expanded", state.expanded);
    const skin = SKINS.find((s) => s.id === state.skin) || SKINS[0];
    label.textContent = skin.name;
    if (badge) badge.textContent = skin.name.toUpperCase();
    hint.textContent = state.expanded
      ? `Consola expandida · ${Math.round(state.scale * 100)}%`
      : `Tamaño PC: ${Math.round(state.scale * 100)}%`;
    expandBtn.textContent = state.expanded ? "Encoger consola" : "Expandir consola";
    grid.querySelectorAll(".skin-swatch").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.skin === state.skin);
    });
    saveState(state);
  }

  function setSkin(id) {
    state.skin = id;
    apply();
    audio?.blip?.();
  }

  grid.replaceChildren(
    ...SKINS.map((skin) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "skin-swatch";
      btn.dataset.skin = skin.id;
      btn.title = skin.name;
      btn.style.background = skin.swatch;
      btn.setAttribute("aria-label", skin.name);
      btn.addEventListener("click", () => setSkin(skin.id));
      return btn;
    })
  );

  document.getElementById("skin-prev").addEventListener("click", () => {
    const i = SKINS.findIndex((s) => s.id === state.skin);
    setSkin(SKINS[(i - 1 + SKINS.length) % SKINS.length].id);
  });
  document.getElementById("skin-next").addEventListener("click", () => {
    const i = SKINS.findIndex((s) => s.id === state.skin);
    setSkin(SKINS[(i + 1) % SKINS.length].id);
  });

  document.getElementById("size-down").addEventListener("click", () => {
    const i = Math.max(0, SCALES.indexOf(nearestScale(state.scale)) - 1);
    state.scale = SCALES[i];
    if (state.scale < EXPAND_SCALE) state.expanded = false;
    apply();
  });
  document.getElementById("size-up").addEventListener("click", () => {
    const i = Math.min(SCALES.length - 1, SCALES.indexOf(nearestScale(state.scale)) + 1);
    state.scale = SCALES[i];
    state.expanded = state.scale >= EXPAND_SCALE;
    apply();
  });
  expandBtn.addEventListener("click", () => {
    state.expanded = !state.expanded;
    state.scale = state.expanded ? EXPAND_SCALE : 0.85;
    apply();
    audio?.confirm?.();
  });

  apply();
}
