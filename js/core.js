export const W = 160;
export const H = 144;

export const PAL = {
  lightest: [155, 188, 15],
  light: [139, 172, 15],
  dark: [48, 98, 48],
  darkest: [15, 56, 15],
};

export function hex(rgb) {
  return `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
}

const FONT = {
  " ": [0, 0, 0, 0, 0],
  A: [0x1e, 0x11, 0x1f, 0x11, 0x11],
  B: [0x1e, 0x11, 0x1e, 0x11, 0x1e],
  C: [0x1f, 0x10, 0x10, 0x10, 0x1f],
  D: [0x1e, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x1e, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x1e, 0x10, 0x10],
  G: [0x1f, 0x10, 0x13, 0x11, 0x1f],
  H: [0x11, 0x11, 0x1f, 0x11, 0x11],
  I: [0x1f, 0x04, 0x04, 0x04, 0x1f],
  J: [0x01, 0x01, 0x01, 0x11, 0x1e],
  K: [0x11, 0x12, 0x1c, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x1e, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x1e, 0x12, 0x11],
  S: [0x0f, 0x10, 0x0e, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x15, 0x1b, 0x11],
  X: [0x11, 0x0a, 0x04, 0x0a, 0x11],
  Y: [0x11, 0x0a, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x02, 0x04, 0x08, 0x1f],
  0: [0x0e, 0x13, 0x15, 0x19, 0x0e],
  1: [0x04, 0x0c, 0x04, 0x04, 0x0e],
  2: [0x1e, 0x01, 0x0e, 0x10, 0x1f],
  3: [0x1e, 0x01, 0x0e, 0x01, 0x1e],
  4: [0x11, 0x11, 0x1f, 0x01, 0x01],
  5: [0x1f, 0x10, 0x1e, 0x01, 0x1e],
  6: [0x0e, 0x10, 0x1e, 0x11, 0x0e],
  7: [0x1f, 0x01, 0x02, 0x04, 0x04],
  8: [0x0e, 0x11, 0x0e, 0x11, 0x0e],
  9: [0x0e, 0x11, 0x0f, 0x01, 0x0e],
  ">": [0x08, 0x04, 0x02, 0x04, 0x08],
  "-": [0x00, 0x00, 0x1f, 0x00, 0x00],
  ".": [0x00, 0x00, 0x00, 0x00, 0x04],
  ":": [0x00, 0x04, 0x00, 0x04, 0x00],
  "/": [0x01, 0x02, 0x04, 0x08, 0x10],
  "!": [0x04, 0x04, 0x04, 0x00, 0x04],
  "?": [0x0e, 0x01, 0x06, 0x00, 0x04],
  "+": [0x00, 0x04, 0x1f, 0x04, 0x00],
  "*": [0x00, 0x15, 0x0e, 0x15, 0x00],
};

export class LCD {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
  }

  clear(color = PAL.lightest) {
    this.ctx.fillStyle = hex(color);
    this.ctx.fillRect(0, 0, W, H);
  }

  rect(x, y, w, h, color) {
    this.ctx.fillStyle = hex(color);
    this.ctx.fillRect(x | 0, y | 0, w, h);
  }

  pixel(x, y, color) {
    this.ctx.fillStyle = hex(color);
    this.ctx.fillRect(x | 0, y | 0, 1, 1);
  }

  text(str, x, y, color = PAL.darkest, scale = 1) {
    const s = String(str).toUpperCase();
    let cx = x;
    for (const ch of s) {
      const g = FONT[ch] || FONT["?"];
      for (let row = 0; row < 5; row += 1) {
        const bits = g[row];
        for (let col = 0; col < 5; col += 1) {
          if (bits & (1 << (4 - col))) {
            this.rect(cx + col * scale, y + row * scale, scale, scale, color);
          }
        }
      }
      cx += 6 * scale;
    }
  }

  centerText(str, y, color, scale = 1) {
    const w = String(str).length * 6 * scale - scale;
    this.text(str, ((W - w) / 2) | 0, y, color, scale);
  }
}

export class ChipTune {
  constructor() {
    this.ctx = null;
  }

  ensure() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  tone(freq, dur = 0.12, type = "square", gain = 0.05) {
    const ctx = this.ensure();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.stop(ctx.currentTime + dur);
  }

  bootChime() {
    this.tone(870, 0.18, "square", 0.06);
    setTimeout(() => this.tone(1740, 0.55, "square", 0.07), 180);
  }

  blip() {
    this.tone(220, 0.05, "square", 0.04);
  }

  confirm() {
    this.tone(520, 0.08, "square", 0.05);
    setTimeout(() => this.tone(780, 0.12, "square", 0.05), 80);
  }

  line() {
    this.tone(330, 0.06);
    setTimeout(() => this.tone(440, 0.08), 50);
    setTimeout(() => this.tone(660, 0.1), 100);
  }

  gameOver() {
    this.tone(196, 0.2);
    setTimeout(() => this.tone(164, 0.25), 180);
    setTimeout(() => this.tone(130, 0.4), 380);
  }
}

const KEYMAP = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
  KeyZ: "b",
  KeyJ: "b",
  KeyX: "a",
  KeyK: "a",
  Enter: "start",
  Space: "start",
  ShiftLeft: "select",
  ShiftRight: "select",
  Backspace: "select",
};

export class Pad {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.comboMenu = false;
  }

  set(btn, on) {
    if (!btn) return;
    if (on) {
      if (!this.down.has(btn)) this.pressed.add(btn);
      this.down.add(btn);
    } else {
      this.down.delete(btn);
    }
    const el = document.querySelector(`[data-btn="${btn}"]`);
    if (el) el.classList.toggle("pressed", on);
  }

  isDown(btn) {
    return this.down.has(btn);
  }

  just(btn) {
    return this.pressed.has(btn);
  }

  consume() {
    const p = new Set(this.pressed);
    this.pressed.clear();
    return p;
  }

  bind() {
    window.addEventListener("keydown", (e) => {
      const btn = KEYMAP[e.code];
      if (!btn) return;
      e.preventDefault();
      this.set(btn, true);
    });
    window.addEventListener("keyup", (e) => {
      const btn = KEYMAP[e.code];
      if (!btn) return;
      e.preventDefault();
      this.set(btn, false);
    });

    const bindEl = (el) => {
      const btn = el.dataset.btn;
      const on = (ev) => {
        ev.preventDefault();
        this.set(btn, true);
      };
      const off = (ev) => {
        ev.preventDefault();
        this.set(btn, false);
      };
      el.addEventListener("pointerdown", on);
      el.addEventListener("pointerup", off);
      el.addEventListener("pointerleave", off);
      el.addEventListener("pointercancel", off);
      el.addEventListener("click", (ev) => {
        ev.preventDefault();
        this.set(btn, true);
        window.setTimeout(() => this.set(btn, false), 90);
      });
    };
    document.querySelectorAll("[data-btn]").forEach(bindEl);
  }
}
