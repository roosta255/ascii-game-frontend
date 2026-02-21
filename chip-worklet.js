// AudioWorklet global: sampleRate is already defined

const SAMPLE_RATE = sampleRate;
const MAX_VOICES = 8;

class Voice {
  constructor() {
    this.wave = "square";
    this.freq = 440;
    this.phase = 0;
    this.volume = 0;
    this.decay = 0;
    this.active = false;
  }
}

class ChipSynthProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voices = [];

    for (let i = 0; i < MAX_VOICES; i++) {
      this.voices.push(new Voice());
    }

    this.port.onmessage = (e) => this.onMessage(e.data);
  }

  onMessage(data) {
    if (data.type !== "play") return;

    const v = this.voices.find(v => !v.active);
    if (!v) return;

    v.wave = data.wave;
    v.freq = data.freq ?? 440;
    v.phase = 0;
    v.volume = data.volume ?? 0.3;
    v.decay = data.decay ?? 6;
    v.active = true;
  }

  process(_, outputs) {
    const output = outputs[0][0];

    for (let i = 0; i < output.length; i++) {
      let mix = 0;

      for (const v of this.voices) {
        if (!v.active) continue;

        let sample = 0;

        if (v.wave === "square") {
          sample = v.phase < 0.5 ? 1 : -1;
          v.phase += v.freq / SAMPLE_RATE;
          if (v.phase >= 1) v.phase -= 1;
        } else {
          sample = Math.random() < 0.5 ? 1 : -1;
        }

        mix += sample * v.volume;

        v.volume -= v.decay / SAMPLE_RATE;
        if (v.volume <= 0) v.active = false;
      }

      output[i] = Math.max(-1, Math.min(1, mix * 0.3));
    }

    return true;
  }
}

registerProcessor("chip-synth", ChipSynthProcessor);
