// Captures mono Float32 frames from the mic graph and emits ~100ms chunks of
// raw PCM16LE, which is exactly what AssemblyAI's streaming socket expects.
// The AudioContext is created at 16 kHz, so no manual resampling is needed.
const CHUNK_SAMPLES = 1600; // 100ms @ 16kHz

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = new Int16Array(CHUNK_SAMPLES);
    this.n = 0;
  }

  process(inputs) {
    const ch = inputs[0]?.[0];
    if (!ch) return true;

    let peak = 0;
    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      if (s > peak) peak = s;
      else if (-s > peak) peak = -s;

      this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;

      if (this.n === CHUNK_SAMPLES) {
        // Transfer the buffer rather than copying it on every chunk.
        const out = this.buf.buffer;
        this.port.postMessage({ audio: out, peak }, [out]);
        this.buf = new Int16Array(CHUNK_SAMPLES);
        this.n = 0;
        peak = 0;
      }
    }
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
