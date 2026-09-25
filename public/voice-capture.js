
class VoiceCapture extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const { inputSampleRate, targetSampleRate } = options.processorOptions;
    this.ratio = inputSampleRate / targetSampleRate;
    this.muted = false;
    this.port.onmessage = (e) => {
      if (e.data && typeof e.data.muted === "boolean") this.muted = e.data.muted;
    };
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;

    let peak = 0;
    for (let i = 0; i < input.length; i++) {
      const a = input[i] < 0 ? -input[i] : input[i];
      if (a > peak) peak = a;
    }

    if (this.muted) {
      this.port.postMessage({ peak, audio: null });
      return true;
    }

    const outLength = Math.floor(input.length / this.ratio);
    const pcm16 = new Int16Array(outLength);
    for (let i = 0; i < outLength; i++) {
      const s = input[Math.floor(i * this.ratio)] || 0;
      const clamped = s < -1 ? -1 : s > 1 ? 1 : s;
      pcm16[i] = Math.round(clamped * 32767);
    }

    this.port.postMessage({ peak, audio: pcm16.buffer }, [pcm16.buffer]);
    return true;
  }
}

registerProcessor("voice-capture", VoiceCapture);
