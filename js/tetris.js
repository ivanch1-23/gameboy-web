import { PAL, W, H } from "./core.js";

const COLS = 10;
const ROWS = 18;
const SIZE = 8;
const OX = 4;
const OY = 0;

const SHAPES = {
  I: [[[0, 1], [1, 1], [2, 1], [3, 1]], [[2, 0], [2, 1], [2, 2], [2, 3]]],
  O: [[[1, 0], [2, 0], [1, 1], [2, 1]]],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
};

const NAMES = Object.keys(SHAPES);

function emptyGrid() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function collide(grid, cells, x, y) {
  return cells.some(([cx, cy]) => {
    const nx = x + cx;
    const ny = y + cy;
    if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
    if (ny >= 0 && grid[ny][nx]) return true;
    return false;
  });
}

export class Tetris {
  constructor(audio) {
    this.audio = audio;
    this.reset();
  }

  reset() {
    this.grid = emptyGrid();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.over = false;
    this.dropMs = 700;
    this.lastDrop = performance.now();
    this.das = 0;
    this.next = this.randomPiece();
    this.spawn();
  }

  randomPiece() {
    const name = NAMES[(Math.random() * NAMES.length) | 0];
    return { name, rot: 0 };
  }

  cellsOf(p) {
    const list = SHAPES[p.name];
    return list[p.rot % list.length];
  }

  spawn() {
    this.piece = this.next;
    this.next = this.randomPiece();
    this.x = 3;
    this.y = 0;
    if (collide(this.grid, this.cellsOf(this.piece), this.x, this.y)) {
      this.over = true;
      this.audio.gameOver();
    }
  }

  rotate() {
    if (this.over) return;
    const next = { ...this.piece, rot: this.piece.rot + 1 };
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
      if (!collide(this.grid, this.cellsOf(next), this.x + k, this.y)) {
        this.piece = next;
        this.x += k;
        this.audio.blip();
        return;
      }
    }
  }

  move(dx) {
    if (this.over) return;
    if (!collide(this.grid, this.cellsOf(this.piece), this.x + dx, this.y)) {
      this.x += dx;
    }
  }

  softDrop() {
    if (this.over) return;
    if (!collide(this.grid, this.cellsOf(this.piece), this.x, this.y + 1)) {
      this.y += 1;
      this.score += 1;
    } else this.lock();
  }

  hardDrop() {
    if (this.over) return;
    while (!collide(this.grid, this.cellsOf(this.piece), this.x, this.y + 1)) {
      this.y += 1;
      this.score += 2;
    }
    this.lock();
  }

  ghostY() {
    let gy = this.y;
    while (!collide(this.grid, this.cellsOf(this.piece), this.x, gy + 1)) gy += 1;
    return gy;
  }

  lock() {
    for (const [cx, cy] of this.cellsOf(this.piece)) {
      const ny = this.y + cy;
      const nx = this.x + cx;
      if (ny >= 0) this.grid[ny][nx] = this.piece.name;
    }
    this.clearLines();
    this.spawn();
  }

  clearLines() {
    let n = 0;
    this.grid = this.grid.filter((row) => {
      const full = row.every(Boolean);
      if (full) n += 1;
      return !full;
    });
    while (this.grid.length < ROWS) this.grid.unshift(Array(COLS).fill(0));
    if (n) {
      this.lines += n;
      this.score += [0, 40, 100, 300, 1200][n] * this.level;
      this.level = 1 + Math.floor(this.lines / 10);
      this.dropMs = Math.max(90, 700 - (this.level - 1) * 55);
      this.audio.line();
    } else this.audio.blip();
  }

  update(now, pad) {
    if (this.over) {
      if (pad.just("start") || pad.just("a")) this.reset();
      return;
    }
    if (pad.just("left")) this.move(-1);
    if (pad.just("right")) this.move(1);
    if (pad.isDown("left") || pad.isDown("right")) {
      this.das += 16;
      if (this.das > 180) {
        this.move(pad.isDown("left") ? -1 : 1);
        this.das = 140;
      }
    } else this.das = 0;

    if (pad.just("up") || pad.just("a")) this.rotate();
    if (pad.just("b")) this.hardDrop();
    if (pad.isDown("down")) this.softDrop();

    if (now - this.lastDrop > this.dropMs) {
      this.lastDrop = now;
      if (!collide(this.grid, this.cellsOf(this.piece), this.x, this.y + 1)) this.y += 1;
      else this.lock();
    }
  }

  draw(lcd) {
    lcd.clear(PAL.light);
    lcd.rect(0, 0, 88, H, PAL.lightest);
    lcd.rect(88, 0, W - 88, H, PAL.light);

    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const filled = this.grid[y][x];
        lcd.rect(OX + x * SIZE, OY + y * SIZE, SIZE - 1, SIZE - 1, filled ? PAL.darkest : PAL.light);
        if (filled) lcd.rect(OX + x * SIZE + 1, OY + y * SIZE + 1, 2, 2, PAL.light);
      }
    }

    if (!this.over) {
      const gy = this.ghostY();
      for (const [cx, cy] of this.cellsOf(this.piece)) {
        lcd.rect(OX + (this.x + cx) * SIZE, OY + (gy + cy) * SIZE, SIZE - 1, SIZE - 1, PAL.dark);
      }
      for (const [cx, cy] of this.cellsOf(this.piece)) {
        lcd.rect(OX + (this.x + cx) * SIZE, OY + (this.y + cy) * SIZE, SIZE - 1, SIZE - 1, PAL.darkest);
        lcd.rect(OX + (this.x + cx) * SIZE + 1, OY + (this.y + cy) * SIZE + 1, 2, 2, PAL.light);
      }
    }

    lcd.text("TETRIS", 96, 8, PAL.darkest);
    lcd.text("SCORE", 96, 24, PAL.dark);
    lcd.text(String(this.score).padStart(6, "0"), 96, 32, PAL.darkest);
    lcd.text("LINE", 96, 48, PAL.dark);
    lcd.text(String(this.lines), 96, 56, PAL.darkest);
    lcd.text("LV", 96, 72, PAL.dark);
    lcd.text(String(this.level), 96, 80, PAL.darkest);
    lcd.text("NEXT", 96, 96, PAL.dark);
    for (const [cx, cy] of this.cellsOf(this.next)) {
      lcd.rect(100 + cx * 6, 108 + cy * 6, 5, 5, PAL.darkest);
    }

    if (this.over) {
      lcd.rect(8, 52, 72, 36, PAL.lightest);
      lcd.text("GAME", 22, 58, PAL.darkest);
      lcd.text("OVER", 22, 68, PAL.darkest);
      lcd.text("START", 16, 78, PAL.dark);
    }
  }
}
