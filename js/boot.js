import { PAL, W } from "./core.js";

export function playBoot(lcd, audio, onDone) {
  let t = 0;
  let logoY = -28;
  const start = performance.now();
  let chimed = false;

  function frame(now) {
    t = now - start;
    lcd.clear(PAL.lightest);

    if (t < 220) {
      lcd.rect(0, 0, W, 144, PAL.darkest);
    } else {
      logoY = Math.min(42, -28 + (t - 220) / 8);

      lcd.rect(48, logoY, 64, 22, PAL.darkest);
      lcd.rect(52, logoY + 3, 18, 16, PAL.lightest);
      lcd.rect(58, logoY + 7, 6, 8, PAL.darkest);
      lcd.rect(74, logoY + 3, 34, 16, PAL.lightest);
      lcd.rect(78, logoY + 6, 26, 3, PAL.darkest);
      lcd.rect(78, logoY + 12, 18, 3, PAL.darkest);

      lcd.centerText("GAME BOY", 78, PAL.darkest, 2);
      lcd.centerText("DOT MATRIX", 104, PAL.dark);
      lcd.centerText("WITH STEREO SOUND", 114, PAL.dark);

      if (t > 980 && !chimed) {
        chimed = true;
        audio.bootChime();
      }
    }

    if (t < 2100) requestAnimationFrame(frame);
    else onDone();
  }

  requestAnimationFrame(frame);
}
