// --- AudioWorklet globals ---
declare const sampleRate: number;

declare class AudioWorkletProcessor {
    readonly port: MessagePort;
    constructor();
    process(
        inputs: Float32Array[][],
        outputs: Float32Array[][],
        parameters: Record<string, Float32Array>
    ): boolean;
}

declare function registerProcessor(
    name: string,
    processorCtor: typeof AudioWorkletProcessor
): void;

// --- Synth code ---
const SAMPLE_RATE = sampleRate;
const MAX_VOICES = 8;

type WaveType = "square" | "noise";

class Voice {
    wave: WaveType = "square";
    freq = 440;
    phase = 0;
    volume = 0;
    decay = 0;
    active = false;
}

class ChipSynthProcessor extends AudioWorkletProcessor {
    voices: Voice[] = [];

    constructor() {
        super();

        for (let i = 0; i < MAX_VOICES; i++) {
            this.voices.push(new Voice());
        }

        this.port.onmessage = (e) => this.onMessage(e.data);
    }

    onMessage(data: any) {
        if (data.type !== "play") return;

        const v = this.voices.find(v => !v.active);
        if (!v) return;

        v.wave = data.wave;
        v.freq = data.freq ?? 0;
        v.phase = 0;
        v.volume = data.volume;
        v.decay = data.decay;
        v.active = true;
    }

    process(_: Float32Array[][], outputs: Float32Array[][]) {
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
                if (v.volume <= 0) {
                    v.active = false;
                }
            }

            output[i] = Math.max(-1, Math.min(1, mix * 0.3));
        }

        return true;
    }
}

registerProcessor("chip-synth", ChipSynthProcessor);
