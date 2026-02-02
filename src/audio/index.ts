import { ChipSynth } from "./audio";

let synth: ChipSynth | null = null;
let initialized = false;

export function getSynth(): ChipSynth {
    if (!synth) {
        synth = new ChipSynth();
    }
    return synth;
}

export async function initAudioOnce() {
    if (initialized) return;

    initialized = true;
    await getSynth().init();
}

export function resumeAudio() {
    getSynth().resume();
}
