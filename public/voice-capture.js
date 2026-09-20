/**
 * Microphone capture for the Voice Agent API: Float32 -> PCM16 at 24 kHz.
 *
 * The obvious shortcut is `new AudioContext({ sampleRate: 24000 })` and no
 * resampling, but it only works in Chromium. Firefox honours the rate while
 * quietly routing that context around its echo canceller — so the agent hears
 * its own voice through the speakers and interrupts itself on every reply —
 * and Safari ignores the option entirely, running at 48 kHz and producing
 * chipmunked audio. So the context stays at the device rate and the
 * conversion happens here, where it is the same three lines on every browser.
 *
 * Also reports a peak amplitude per block. That number drives the orb on
 * screen, which is why it is measured from the real signal here rather than
 * approximated with a CSS animation.
 */
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

    // Still report level while muted so the UI can show the mic is live and
    // simply not being sent — a silent orb would read as a broken microphone.
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
