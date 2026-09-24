import { LCD, ChipTune, Pad, PAL } from "./core.js";
import { playBoot } from "./boot.js";
import { Tetris } from "./tetris.js";
import { Snake } from "./snake.js";
import { GbEmu } from "./emu.js";
import { initShells } from "./skins.js";

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

function applyRomPayload(data, { fillPath = true } = {}) {
  roms = data.roms || [];
  const pathInput = document.getElementById("rom-path");
  if (fillPath && pathInput && data.customPath != null && document.activeElement !== pathInput) {
    pathInput.value = data.customPath;
  }
  romStatus.textContent = roms.length
    ? `${roms.length} cartucho(s)`
    : "No hay .gb/.gbc/.zip en esa carpeta.";
  renderRomSidebar();
  if (mode === "menu") drawMenu();
}

async function refreshRoms() {
  try {
    const res = await fetch("/api/roms");
    if (!res.ok) throw new Error("http");
    applyRomPayload(await res.json());
  } catch {
    roms = [];
    romStatus.textContent = "Servidor local no listó ROMs. Usá Examinar o Abrir archivo.";
    renderRomSidebar();
    if (mode === "menu") drawMenu();
  }
}

async function setRomFolder() {
  const pathInput = document.getElementById("rom-path");
  const path = pathInput.value.trim();
  if (!path) {
    romStatus.textContent = "Escribí una ruta o dale a Examinar…";
    pathInput.focus();
    return;
  }
  romStatus.textContent = "Cargando carpeta…";
  try {
    const res = await fetch("/api/rom-folder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
    const data = await res.json();
    if (!res.ok || data.ok === false) {
      romStatus.textContent = data.error || "No se pudo usar esa carpeta.";
      return;
    }
    applyRomPayload(data);
  } catch {
    romStatus.textContent = "No se pudo guardar la ruta. ¿Está corriendo el server?";
  }
}

function loadPickedFolder(fileList) {
  const files = [...(fileList || [])];
  const romFiles = files.filter((f) => /\.(gb|gbc|sgb|bin)$/i.test(f.name));
  const zipCount = files.filter((f) => /\.zip$/i.test(f.name)).length;
  if (!romFiles.length) {
    romStatus.textContent = zipCount
      ? "Esa carpeta tiene .zip. Descomprimilos o escribí la ruta completa y dale a Cargar ruta."
      : "Esa carpeta no tiene .gb / .gbc.";
    return;
  }
  const folder = (romFiles[0].webkitRelativePath || romFiles[0].name).split(/[/\\]/)[0];
  document.getElementById("rom-path").value = folder;
  roms = romFiles
    .sort((a, b) => a.name.localeCompare(b.name, "es"))
    .map((file) => ({ name: file.name, file, folder }));
  romStatus.textContent = `${roms.length} cartucho(s) en ${folder}`;
  renderRomSidebar();
  if (mode === "menu") drawMenu();
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
    b.addEventListener("click", () => loadRomFromServer(r));
    li.append(b);
    romListEl.append(li);
  });
}

async function loadRomFromServer(r) {
  romStatus.textContent = `Cargando ${r.name}…`;
  try {
    let buf;
    if (r.file) buf = await r.file.arrayBuffer();
    else {
      const res = await fetch(r.url);
      buf = await res.arrayBuffer();
    }
    await startRom(buf, r.name);
  } catch (err) {
    romStatus.textContent = `No se pudo cargar: ${err.message || err}`;
  }
}

async function startRom(buffer, name) {
  audio.ensure();
  mode = "rom";
  try {
    if (emu.audioCtx) await emu.audioCtx.resume?.();
    await emu.load(buffer, name);
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
    loadRomFromServer(it.rom);
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
window.addEventListener("pointerdown", () => audio.ensure(), { once: true });
window.addEventListener("keydown", () => audio.ensure(), { once: true });
power.addEventListener("change", () => {
  audio.ensure();
  if (power.checked) powerOn();
  else powerOff();
});

document.getElementById("refresh-roms").addEventListener("click", refreshRoms);
document.getElementById("rom-dir").addEventListener("change", (e) => {
  loadPickedFolder(e.target.files);
  e.target.value = "";
});
document.getElementById("rom-path-btn").addEventListener("click", setRomFolder);
document.getElementById("rom-path").addEventListener("keydown", (e) => {
  if (e.key === "Enter") setRomFolder();
});
document.getElementById("rom-file").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const buf = await file.arrayBuffer();
  await startRom(buf, file.name);
  e.target.value = "";
});

refreshRoms();
powerOn();
requestAnimationFrame(tick);
