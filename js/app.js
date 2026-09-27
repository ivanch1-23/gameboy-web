import { LCD, ChipTune, Pad, PAL } from "./core.js";
import { playBoot } from "./boot.js";
import { Tetris } from "./tetris.js";
import { Snake } from "./snake.js";
import { GbEmu } from "./emu.js";
import { initShells } from "./skins.js";
import {
  deleteRom,
  deleteState,
  getBestScore,
  getRom,
  getSave,
  listRoms,
  listStates,
  putBestScore,
  putRom,
  putSave,
  putState,
  saveNewState,
  stateId,
} from "./storage.js";
import { initPwa } from "./pwa.js";

const BUILTIN = { tetris: "builtin:tetris", snake: "builtin:snake" };

const lcd = new LCD(document.getElementById("lcd"));
const audio = new ChipTune();
const pad = new Pad();
const emu = new GbEmu(document.getElementById("lcd"));
const tetris = new Tetris(audio);
const snake = new Snake(audio);

const romListEl = document.getElementById("rom-list");
const stateListEl = document.getElementById("state-list");
const romStatus = document.getElementById("rom-status");
const stateStatus = document.getElementById("state-status");
const led = document.getElementById("led");
const gb = document.getElementById("gb");
const power = document.getElementById("power");

let mode = "off";
let menuIndex = 0;
let roms = [];
let lastSelectStart = false;
let rafId = 0;
let currentRomId = null;
let pickKind = null;
let pickItems = [];
let pickIndex = 0;

function scoredGame(kind) {
  if (kind === "tetris") return tetris;
  if (kind === "snake") return snake;
  return null;
}

function fmtWhen(ts) {
  const d = new Date(ts || Date.now());
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmtSlot(row) {
  if (row.slot === 0) return ("CONT " + fmtWhen(row.createdAt)).slice(0, 14);
  return `${row.slot} ${fmtWhen(row.createdAt)}`.slice(0, 14);
}

function considerBest(gameId, game) {
  if (!game || typeof game.score !== "number") return;
  if (game.score <= (game.best || 0)) return;
  game.best = game.score;
  putBestScore(gameId, game.score).then((best) => {
    game.best = best;
  });
}

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

function drawPick() {
  if (!pickItems.length) return;
  pickIndex = ((pickIndex % pickItems.length) + pickItems.length) % pickItems.length;
  lcd.clear(PAL.lightest);
  const title = pickKind === "rom" ? "ESTADOS" : String(pickKind || "").toUpperCase();
  lcd.centerText(title.slice(0, 12), 8, PAL.darkest);
  lcd.rect(10, 22, 140, 2, PAL.dark);
  const start = Math.max(0, pickIndex - 4);
  const view = pickItems.slice(start, start + 6);
  view.forEach((it, i) => {
    const abs = start + i;
    const y = 32 + i * 14;
    if (abs === pickIndex) {
      lcd.rect(6, y - 2, 148, 12, PAL.dark);
      lcd.text(">", 10, y, PAL.lightest);
      lcd.text(it.label, 22, y, PAL.lightest);
    } else {
      lcd.text(it.label, 22, y, PAL.darkest);
    }
  });
  lcd.text("A:OK  B:ATRAS", 8, 132, PAL.dark);
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
      await renderStateSidebar();
    });
    const wrap = document.createElement("div");
    wrap.className = "rom-row";
    wrap.append(b, del);
    li.append(wrap);
    romListEl.append(li);
  });
}

async function renderStateSidebar() {
  if (!stateListEl) return;
  stateListEl.replaceChildren();
  if (!currentRomId) {
    if (stateStatus) stateStatus.textContent = "Abrí un juego para ver y guardar estados.";
    return;
  }
  const rows = await listStates(currentRomId);
  if (stateStatus) {
    stateStatus.textContent = rows.length
      ? `${rows.length} estado(s) guardado(s).`
      : "Todavía no hay estados. Guardá uno desde acá o en la consola.";
  }
  if (!rows.length) {
    const li = document.createElement("li");
    li.innerHTML = "<button type='button' disabled>sin estados</button>";
    stateListEl.append(li);
    return;
  }
  rows.forEach((row) => {
    const li = document.createElement("li");
    const load = document.createElement("button");
    load.type = "button";
    load.textContent = fmtSlot(row);
    load.addEventListener("click", () => loadSavedState(row));
    const del = document.createElement("button");
    del.type = "button";
    del.className = "rom-del";
    del.textContent = "×";
    del.title = "Borrar estado";
    del.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      await deleteState(row.id);
      await renderStateSidebar();
    });
    const wrap = document.createElement("div");
    wrap.className = "rom-row";
    wrap.append(load, del);
    li.append(wrap);
    stateListEl.append(li);
  });
}

async function showStatePicker(kind, romId, states) {
  currentRomId = romId;
  pickKind = kind;
  pickItems = [{ kind: "new", label: "NUEVO" }];
  states.forEach((s) => pickItems.push({ kind: "slot", label: fmtSlot(s), state: s }));
  pickIndex = 0;
  mode = "pick";
  drawPick();
  await renderStateSidebar();
}

async function loadSavedState(row) {
  if (!row) return;
  if (currentRomId === BUILTIN.tetris || pickKind === "tetris") {
    if (row.json) tetris.restore(row.json);
    else tetris.reset();
    mode = "tetris";
    return;
  }
  if (currentRomId === BUILTIN.snake || pickKind === "snake") {
    if (row.json) snake.restore(row.json);
    else snake.reset();
    mode = "snake";
    return;
  }
  if (mode === "rom" || (mode === "pick" && emu.e)) {
    if (row.data && emu.applyState(row.data)) {
      emu.pause(false);
      mode = "rom";
      romStatus.textContent = `Estado ${row.slot} cargado.`;
    } else {
      romStatus.textContent = "No se pudo cargar ese estado.";
    }
  }
}

async function confirmPick() {
  const it = pickItems[pickIndex];
  if (!it) return;
  audio.confirm();
  if (pickKind === "rom") {
    if (it.kind === "slot") await loadSavedState(it.state);
    else {
      emu.pause(false);
      mode = "rom";
    }
    return;
  }
  const game = scoredGame(pickKind);
  if (it.kind === "slot" && it.state?.json) game.restore(it.state.json);
  else game.reset();
  mode = pickKind;
}

async function openBuiltin(kind) {
  emu.stop();
  const game = scoredGame(kind);
  game.best = await getBestScore(kind);
  const states = await listStates(BUILTIN[kind]);
  if (states.length) {
    await showStatePicker(kind, BUILTIN[kind], states);
  } else {
    game.reset();
    currentRomId = BUILTIN[kind];
    pickKind = kind;
    mode = kind;
    await renderStateSidebar();
  }
}

async function saveCurrentState() {
  try {
    if (mode === "rom" || (mode === "pick" && pickKind === "rom" && emu.e)) {
      const data = emu.captureState();
      if (!data?.byteLength) {
        if (stateStatus) stateStatus.textContent = "No hay estado para guardar todavía.";
        return;
      }
      await saveNewState(currentRomId || emu.saveId, { data, kind: "emu" });
      if (stateStatus) stateStatus.textContent = "Estado guardado.";
      audio.confirm();
      await renderStateSidebar();
      return;
    }
    const kind = mode === "pick" ? pickKind : mode;
    const game = scoredGame(kind);
    if (game) {
      await considerBest(kind, game);
      await saveNewState(BUILTIN[kind], { json: game.snapshot(), kind: "json" });
      if (stateStatus) stateStatus.textContent = "Estado guardado.";
      audio.confirm();
      await renderStateSidebar();
    } else if (stateStatus) {
      stateStatus.textContent = "Abrí un juego para guardar un estado.";
    }
  } catch (err) {
    if (stateStatus) stateStatus.textContent = `No se pudo guardar: ${err.message || err}`;
  }
}

async function persistBuiltin(kind) {
  const game = scoredGame(kind);
  if (!game) return;
  await considerBest(kind, game);
  if (game.over) return;
  await putState({
    id: stateId(BUILTIN[kind], 0),
    romId: BUILTIN[kind],
    slot: 0,
    json: game.snapshot(),
    kind: "json",
  });
}

async function exitToMenu() {
  if (mode === "tetris") await persistBuiltin("tetris");
  if (mode === "snake") await persistBuiltin("snake");
  emu.stop();
  mode = "menu";
  drawMenu();
  audio.blip();
  await renderStateSidebar();
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
  const ctx = audio.ensure();
  if (ctx.state === "suspended") await ctx.resume().catch(() => {});
  try {
    emu.onSaveRam = (sid, ram) => {
      if (sid) putSave(sid, ram);
    };
    await emu.load(buffer, name, {
      saveId: saveId || name,
      saveRam,
      audioCtx: ctx,
      paused: true,
    });
    await emu.unlockAudio();
    currentRomId = saveId || name;
    const states = await listStates(currentRomId);
    romStatus.textContent = `Jugando ${name}`;
    if (states.length) {
      await showStatePicker("rom", currentRomId, states);
    } else {
      emu.pause(false);
      mode = "rom";
      pickKind = "rom";
      await renderStateSidebar();
    }
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
  if (it.kind === "tetris") openBuiltin("tetris");
  else if (it.kind === "snake") openBuiltin("snake");
  else if (it.kind === "rom") loadStoredRom(it.rom.id);
  else if (it.kind === "file") document.getElementById("rom-file").click();
}

function maybeMenuCombo() {
  const both = pad.isDown("select") && pad.isDown("start");
  if (both && !lastSelectStart && mode !== "boot" && mode !== "off") {
    exitToMenu();
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
  } else if (mode === "pick") {
    if (pressed.has("up")) {
      pickIndex -= 1;
      audio.blip();
      drawPick();
    }
    if (pressed.has("down")) {
      pickIndex += 1;
      audio.blip();
      drawPick();
    }
    if (pressed.has("a") || pressed.has("start")) confirmPick();
    if (pressed.has("b")) {
      emu.stop();
      mode = "menu";
      drawMenu();
      audio.blip();
    }
  } else if (mode === "tetris") {
    if (pressed.has("select")) {
      exitToMenu();
    } else {
      tetris.update(now, { just: (b) => pressed.has(b), isDown: (b) => pad.isDown(b) });
      considerBest("tetris", tetris);
      tetris.draw(lcd);
    }
  } else if (mode === "snake") {
    if (pressed.has("select")) {
      exitToMenu();
    } else {
      snake.update(now, { just: (b) => pressed.has(b), isDown: (b) => pad.isDown(b) });
      considerBest("snake", snake);
      snake.draw(lcd);
    }
  } else if (mode === "rom") {
    emu.applyPad(pad);
  }
}

pad.bind();
initShells({ audio });

function initMobileMenu() {
  const toggle = document.getElementById("menu-toggle");
  const backdrop = document.getElementById("menu-backdrop");
  if (!toggle || !backdrop) return;

  function setOpen(open) {
    document.body.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    backdrop.hidden = !open;
  }

  toggle.addEventListener("click", () => {
    setOpen(!document.body.classList.contains("menu-open"));
  });
  backdrop.addEventListener("click", () => setOpen(false));
}

function unlockAudio() {
  audio.ensure();
  emu.unlockAudio?.();
}

initPwa();
initMobileMenu();
window.addEventListener("pointerdown", unlockAudio);
window.addEventListener("touchstart", unlockAudio, { passive: true });
window.addEventListener("keydown", unlockAudio);
power.addEventListener("change", () => {
  audio.ensure();
  if (power.checked) powerOn();
  else powerOff();
});

document.getElementById("refresh-roms").addEventListener("click", refreshRoms);
document.getElementById("save-state")?.addEventListener("click", saveCurrentState);
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

getBestScore("tetris").then((n) => {
  tetris.best = n;
});
getBestScore("snake").then((n) => {
  snake.best = n;
});
refreshRoms();
renderStateSidebar();
powerOn();
requestAnimationFrame(tick);
