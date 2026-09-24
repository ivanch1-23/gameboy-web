import { PAL } from "./core.js";

const COLS = 16;
const ROWS = 14;
const SIZE = 8;
const OX = 16;
const OY = 16;

function randCell(snake) {
  let p;
  do {
    p = { x: (Math.random() * COLS) | 0, y: (Math.random() * ROWS) | 0 };
  } while (snake.some((s) => s.x === p.x && s.y === p.y));
  return p;
}

export class Snake {
  constructor(audio) {
    this.audio = audio;
    this.reset();
  }

  reset() {
    this.snake = [
      { x: 4, y: 7 },
      { x: 3, y: 7 },
      { x: 2, y: 7 },
    ];
    this.dir = { x: 1, y: 0 };
    this.queued = { x: 1, y: 0 };
    this.food = randCell(this.snake);
    this.score = 0;
    this.over = false;
    this.stepMs = 140;
    this.last = performance.now();
  }

  turn(nx, ny) {
    if (this.dir.x + nx === 0 && this.dir.y + ny === 0) return;
    this.queued = { x: nx, y: ny };
  }

  update(now, pad) {
    if (this.over) {
      if (pad.just("start") || pad.just("a")) this.reset();
      return;
    }
    if (pad.just("left")) this.turn(-1, 0);
    if (pad.just("right")) this.turn(1, 0);
    if (pad.just("up")) this.turn(0, -1);
    if (pad.just("down")) this.turn(0, 1);

    if (now - this.last < this.stepMs) return;
    this.last = now;
    this.dir = this.queued;
    const head = this.snake[0];
    const next = { x: head.x + this.dir.x, y: head.y + this.dir.y };
    if (next.x < 0 || next.y < 0 || next.x >= COLS || next.y >= ROWS) {
      this.over = true;
      this.audio.gameOver();
      return;
    }
    if (this.snake.some((s) => s.x === next.x && s.y === next.y)) {
      this.over = true;
      this.audio.gameOver();
      return;
    }
    this.snake.unshift(next);
    if (next.x === this.food.x && next.y === this.food.y) {
      this.score += 10;
      this.stepMs = Math.max(70, this.stepMs - 3);
      this.food = randCell(this.snake);
      this.audio.confirm();
    } else {
      this.snake.pop();
    }
  }

  draw(lcd) {
    lcd.clear(PAL.lightest);
    lcd.rect(OX - 2, OY - 2, COLS * SIZE + 4, ROWS * SIZE + 4, PAL.dark);
    lcd.rect(OX, OY, COLS * SIZE, ROWS * SIZE, PAL.lightest);
    lcd.text("SNAKE", 8, 4, PAL.darkest);
    lcd.text(String(this.score).padStart(4, "0"), 120, 4, PAL.darkest);

    lcd.rect(OX + this.food.x * SIZE, OY + this.food.y * SIZE, SIZE - 1, SIZE - 1, PAL.darkest);
    this.snake.forEach((s, i) => {
      lcd.rect(OX + s.x * SIZE, OY + s.y * SIZE, SIZE - 1, SIZE - 1, i === 0 ? PAL.darkest : PAL.dark);
    });

    if (this.over) {
      lcd.rect(36, 58, 88, 28, PAL.lightest);
      lcd.centerText("GAME OVER", 64, PAL.darkest);
      lcd.centerText("START", 76, PAL.dark);
    }
  }
}
