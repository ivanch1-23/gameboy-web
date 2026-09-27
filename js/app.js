import { LCD, ChipTune, Pad, PAL } from "./core.js";
import { playBoot } from "./boot.js";
import { Tetris } from "./tetris.js";
import { Snake } from "./snake.js";
import { GbEmu } from "./emu.js";
import { initShells } from "./skins.js";
import { deleteRom, getRom, getSave, listRoms, putRom, putSave } from "./storage.js";
import { initPwa } from "./pwa.js";

const lcd = new LCD(document.getElementById("lcd"));
const audio = new ChipTune();
const pad = new Pad();
const emu = new GbEmu(document.getElementById("lcd"));
const tetris = new Tetris(audio);
const snake = new Snake(audio);

const romListEl = document.getElementById("rom-list");
const romStatus = document.getElementById("rom-status");
const led = document.getElementById("led");
const gb = document.getElementById("gb");
const power = document.getElementById("power");

let mode = "off";
let menuIndex = 0;
let roms = [];
let lastSelectStart = false;
let rafId = 0;

function menuItems() {
  const items = [
    { kind: "tetris", label: "TETRIS" },
    { kind: "snake", label: "SNAKE" },
  ];
  roms.forEach((r) => items.push({ kind: "rom", label: r.name.slice(0, 14), rom: r }));
  items.push({ kind: "file", label: "ABRIR FILE" });
  return items;
}

function drawMenu() {
  const items = menuItems();
  menuIndex = ((menuIndex % items.length) + items.length) % items.length;
  lcd.clear(PAL.lightest);
  lcd.centerText("GAME BOY", 8, PAL.darkest, 2);
  lcd.centerText("NINTENDO TM", 26, PAL.dark);
  lcd.rect(10, 40, 140, 2, PAL.dark);

  const start = Math.max(0, menuIndex - 4);
  const view = items.slice(start, start + 6);
  view.forEach((it, i) => {
    const abs = start + i;
    const y = 48 + i * 14;
    if (abs === menuIndex) {
      lcd.rect(6, y - 2, 148, 12, PAL.dark);
      lcd.text(">", 10, y, PAL.lightest);
      lcd.text(it.label, 22, y, PAL.lightest);
    } else {
      lcd.text(it.label, 22, y, PAL.darkest);
    }
  });
  lcd.text("SEL=MENU", 8, 132, PAL.dark);
}

function applyRomList(rows) {
  roms = rows || [];
  romStatus.textContent = roms.length
    ? `${roms.length} cartucho(s) en este navegador (IndexedDB)`
    : "No hay ROMs guardadas. Examiná una carpeta o abrí un archivo.";
  renderRomSidebar();
  if (mode === "menu") drawMenu();
}

async function refreshRoms() {
  try {
    applyRomList(await listRoms());
  } catch {
    roms = [];
    romStatus.textContent = "No se pudo leer IndexedDB. Probá Abrir archivo.";
    renderRomSidebar();
    if (mode === "menu") drawMenu();
  }
}

async function importRomFiles(fileList) {
  const files = [...(fileList || [])].filter((f) => /\.(gb|gbc|sgb|bin)$/i.test(f.name));
  const zipCount = [...(fileList || [])].filter((f) => /\.zip$/i.test(f.name)).length;
  if (!files.length) {
    romStatus.textContent = zipCount
      ? "Los .zip no se importan acá. Descomprimí y elegí los .gb / .gbc."
      : "No hay .gb / .gbc en esa selección.";
    return;
  }
  romStatus.textContent = `Guardando ${files.length} ROM(s)…`;
  for (const file of files) {
    const data = await file.arrayBuffer();
    await putRom({ name: file.name, data });
  }
  await refreshRoms();
}

function renderRomSidebar() {
  romListEl.replaceChildren();
  if (!roms.length) {
    const li = document.createElement("li");
    li.innerHTML = "<button type='button' disabled>vacío</button>";
    romListEl.append(li);
    return;
  }
  roms.forEach((r) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = r.name;
    b.addEventListener("click", () => loadStoredRom(r.id));
    const del = document.createElement("button");
    del.type = "button";
    del.className = "rom-del";
    del.textContent = "×";
    del.title = "Quitar de este navegador";
    del.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      await deleteRom(r.id);
      await refreshRoms();
    });
    const wrap = document.createElement("div");
    wrap.className = "rom-row";
    wrap.append(b, del);
    li.append(wrap);
    romListEl.append(li);
  });
}

async function loadStoredRom(id) {
  romStatus.textContent = "Cargando cartucho…";
  try {
    const row = await getRom(id);
    if (!row) throw new Error("ROM no encontrada");
    const saveRam = await getSave(id);
    await startRom(row.data, row.name, id, saveRam);
  } catch (err) {
    romStatus.textContent = `No se pudo cargar: ${err.message || err}`;
  }
}

async function startRom(buffer, name, saveId, saveRam) {
  audio.ensure();
  mode = "rom";
  try {
    if (emu.audioCtx) await emu.audioCtx.resume?.();
    emu.onSaveRam = (sid, ram) => {
      if (sid) putSave(sid, ram);
    };
    await emu.load(buffer, name, { saveId: saveId || name, saveRam });
    if (emu.audioCtx) await emu.audioCtx.resume();
    romStatus.textContent = `Jugando ${name}`;
  } catch (err) {
    romStatus.textContent = `No se pudo cargar: ${err.message || err}`;
    mode = "menu";
    drawMenu();
  }
}

function powerOn() {
  gb.classList.remove("off");
  led.classList.add("on");
  mode = "boot";
  emu.stop();
  playBoot(lcd, audio, () => {
    mode = "menu";
    drawMenu();
  });
}

function powerOff() {
  gb.classList.add("off");
  led.classList.remove("on");
  mode = "off";
  emu.stop();
  lcd.clear(PAL.darkest);
}

function activate() {
  const items = menuItems();
  const it = items[menuIndex];
  if (!it) return;
  audio.confirm();
  if (it.kind === "tetris") {
    emu.stop();
    tetris.reset();
    mode = "tetris";
  } else if (it.kind === "snake") {
    emu.stop();
    snake.reset();
    mode = "snake";
  } else if (it.kind === "rom") {
    loadStoredRom(it.rom.id);
  } else if (it.kind === "file") {
    document.getElementById("rom-file").click();
  }
}

function maybeMenuCombo() {
  const both = pad.isDown("select") && pad.isDown("start");
  if (both && !lastSelectStart && mode !== "boot" && mode !== "off") {
    emu.stop();
    mode = "menu";
    drawMenu();
    audio.blip();
  }
  lastSelectStart = both;
}

function tick(now) {
  rafId = requestAnimationFrame(tick);
  window.__gbMode = mode;
  const pressed = pad.consume();
  maybeMenuCombo();

  if (mode === "menu") {
    if (pressed.has("up")) {
      menuIndex -= 1;
      audio.blip();
      drawMenu();
    }
    if (pressed.has("down")) {
      menuIndex += 1;
      audio.blip();
      drawMenu();
    }
    if (pressed.has("a") || pressed.has("start")) activate();
  } else if (mode === "tetris") {
    if (pressed.has("select")) {
      mode = "menu";
      drawMenu();
      audio.blip();
    } else {
      tetris.update(now, { just: (b) => pressed.has(b), isDown: (b) => pad.isDown(b) });
      tetris.draw(lcd);
    }
  } else if (mode === "snake") {
    if (pressed.has("select")) {
      mode = "menu";
      drawMenu();
      audio.blip();
    } else {
      snake.update(now, { just: (b) => pressed.has(b), isDown: (b) => pad.isDown(b) });
      snake.draw(lcd);
    }
  } else if (mode === "rom") {
    emu.applyPad(pad);
  }
}

pad.bind();
initShells({ audio });
initPwa();
window.addEventListener("pointerdown", () => audio.ensure(), { once: true });
window.addEventListener("keydown", () => audio.ensure(), { once: true });
power.addEventListener("change", () => {
  audio.ensure();
  if (power.checked) powerOn();
  else powerOff();
});

document.getElementById("refresh-roms").addEventListener("click", refreshRoms);
document.getElementById("rom-dir").addEventListener("change", (e) => {
  importRomFiles(e.target.files);
  e.target.value = "";
});
document.getElementById("rom-file").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await importRomFiles([file]);
  const rows = await listRoms();
  const last = rows.find((r) => r.name === file.name);
  if (last) await loadStoredRom(last.id);
  e.target.value = "";
});

refreshRoms();
powerOn();
requestAnimationFrame(tick);
