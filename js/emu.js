const AUDIO_FRAMES = 4096;
const AUDIO_LATENCY_SEC = 0.1;
const MAX_UPDATE_SEC = 5 / 60;
const CPU_TICKS_PER_SECOND = 4194304;
const EVENT_NEW_FRAME = 1;
const EVENT_AUDIO_BUFFER_FULL = 2;
const EVENT_UNTIL_TICKS = 4;
const CGB_COLOR_CURVE = 2;

function wasmBytes(module, ptr, size) {
  return new Uint8Array(module.HEAP8.buffer, ptr, size);
}

function rgba(r, g, b) {
  return (0xff << 24) | (b << 16) | (g << 8) | r;
}

export class GbEmu {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx2d = canvas.getContext("2d");
    this.imageData = this.ctx2d.createImageData(160, 144);
    this.module = null;
    this.e = 0;
    this.romPtr = 0;
    this.running = false;
    this.raf = null;
    this.joyPtr = 0;
    this.audioBuf = null;
    this.audioStart = 0;
    this.audioCtx = null;
    this.lastRaf = 0;
    this.leftover = 0;
    this.volume = 0.45;
    this.ready = false;
  }

  async init() {
    if (this.ready) return;
    this.module = await Binjgb({
      locateFile: (path) => `vendor/binjgb/${path}`,
    });
    this.ready = true;
  }

  async load(romBuffer, title = "ROM") {
    await this.init();
    this.stop();
    const size = (romBuffer.byteLength + 0x7fff) & ~0x7fff;
    this.romPtr = this.module._malloc(size);
    wasmBytes(this.module, this.romPtr, size).fill(0).set(new Uint8Array(romBuffer));
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.e = this.module._emulator_new_simple(
      this.romPtr,
      size,
      this.audioCtx.sampleRate,
      AUDIO_FRAMES,
      CGB_COLOR_CURVE
    );
    if (!this.e) {
      this.module._free(this.romPtr);
      this.romPtr = 0;
      throw new Error("ROM inválida");
    }

    const colors = [
      rgba(155, 188, 15),
      rgba(139, 172, 15),
      rgba(48, 98, 48),
      rgba(15, 56, 15),
    ];
    for (const pal of [0, 1, 2]) {
      this.module._emulator_set_bw_palette_simple(this.e, pal, ...colors);
    }

    this.joyPtr = this.module._joypad_new();
    this.module._emulator_set_default_joypad_callback(this.e, this.joyPtr);
    this.framePtr = this.module._get_frame_buffer_ptr(this.e);
    this.frameSize = this.module._get_frame_buffer_size(this.e);
    this.audioPtr = this.module._get_audio_buffer_ptr(this.e);
    this.audioCap = this.module._get_audio_buffer_capacity(this.e);
    this.title = title;
    this.running = true;
    this.lastRaf = 0;
    this.leftover = 0;
    this.audioStart = 0;
    this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  applyPad(pad) {
    if (!this.e) return;
    this.module._set_joyp_up(this.e, pad.isDown("up"));
    this.module._set_joyp_down(this.e, pad.isDown("down"));
    this.module._set_joyp_left(this.e, pad.isDown("left"));
    this.module._set_joyp_right(this.e, pad.isDown("right"));
    this.module._set_joyp_A(this.e, pad.isDown("a"));
    this.module._set_joyp_B(this.e, pad.isDown("b"));
    this.module._set_joyp_start(this.e, pad.isDown("start"));
    this.module._set_joyp_select(this.e, pad.isDown("select"));
  }

  ticks() {
    return this.module._emulator_get_ticks_f64(this.e);
  }

  runUntil(until) {
    while (true) {
      const event = this.module._emulator_run_until_f64(this.e, until);
      if (event & EVENT_NEW_FRAME) {
        const buf = wasmBytes(this.module, this.framePtr, this.frameSize);
        this.imageData.data.set(buf);
      }
      if (event & EVENT_AUDIO_BUFFER_FULL) this.pushAudio();
      if (event & EVENT_UNTIL_TICKS) break;
    }
  }

  pushAudio() {
    if (!this.audioCtx || this.audioCtx.state !== "running") return;
    const src = wasmBytes(this.module, this.audioPtr, this.audioCap);
    const now = this.audioCtx.currentTime;
    const latency = now + AUDIO_LATENCY_SEC;
    this.audioStart = this.audioStart || latency;
    if (this.audioStart < now) this.audioStart = latency;
    const buffer = this.audioCtx.createBuffer(2, AUDIO_FRAMES, this.audioCtx.sampleRate);
    const c0 = buffer.getChannelData(0);
    const c1 = buffer.getChannelData(1);
    for (let i = 0; i < AUDIO_FRAMES; i += 1) {
      c0[i] = (src[2 * i] * this.volume) / 255;
      c1[i] = (src[2 * i + 1] * this.volume) / 255;
    }
    const node = this.audioCtx.createBufferSource();
    node.buffer = buffer;
    node.connect(this.audioCtx.destination);
    node.start(this.audioStart);
    this.audioStart += AUDIO_FRAMES / this.audioCtx.sampleRate;
  }

  loop(startMs) {
    if (!this.running) return;
    this.raf = requestAnimationFrame((t) => this.loop(t));
    const startSec = startMs / 1000;
    const deltaSec = Math.max(startSec - (this.lastRaf || startSec), 0);
    const deltaTicks = Math.min(deltaSec, MAX_UPDATE_SEC) * CPU_TICKS_PER_SECOND;
    const runUntilTicks = this.ticks() + deltaTicks - this.leftover;
    this.runUntil(runUntilTicks);
    this.leftover = (this.ticks() - runUntilTicks) | 0;
    this.lastRaf = startSec;
    this.ctx2d.putImageData(this.imageData, 0, 0);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this.e) {
      this.module._emulator_delete(this.e);
      this.e = 0;
    }
    if (this.joyPtr) {
      this.module._joypad_delete(this.joyPtr);
      this.joyPtr = 0;
    }
    if (this.romPtr) {
      this.module._free(this.romPtr);
      this.romPtr = 0;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}
