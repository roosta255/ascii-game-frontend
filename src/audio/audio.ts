export class ChipSynth {
    private ctx?: AudioContext;
    private node?: AudioWorkletNode;
    private ready = false;
    private initializing = false;

    async init() {
        if (this.ready || this.initializing) return;
        console.log("ChipSynth.init");
        this.initializing = true;
    }

    async resume() {
        if (this.ready) {
            if (this.ctx?.state !== "running") {
                await this.ctx.resume();
            }
            return;
        }

        console.log(`ChipSynth creating AudioContext`);
        // First user gesture reaches here
        this.ctx = new AudioContext();
        console.log(`ChipSynth created AudioContext`);

        await this.ctx.audioWorklet.addModule(`${import.meta.env.BASE_URL}chip-worklet.js`);

        this.node = new AudioWorkletNode(this.ctx, "chip-synth");
        this.node.connect(this.ctx.destination);

        this.ready = true;
    }

    private post(msg: any) {
        if (!this.ready || !this.node) return;
        this.node.port.postMessage(msg);
    }

    private schedule(delay: number, fn: () => void) {
        setTimeout(fn, delay * 1000);
    }

    playSquare(freq: number, volume = 0.3, decay = 6) {
        console.log("ChipSynth.playSquare");
        this.init();
        this.resume();
        this.post({ type: "play", wave: "square", freq, volume, decay });
    }

    playNoise(volume = 0.3, decay = 6) {
        this.post({ type: "play", wave: "noise", volume, decay });
    }

    private square(freq: number, volume = 0.3, decay = 6, delay = 0) {
        this.schedule(delay, () => this.playSquare(freq, volume, decay));
    }

    private noise(volume = 0.3, decay = 6, delay = 0) {
        this.schedule(delay, () => this.playNoise(volume, decay));
    }

    crush() {
        this.noise(0.4, 4, 0);
        this.square(90, 0.3, 4, 0);
    }
    poof() {
        this.noise(0.3, 8, 0);
    }
    pickup() {
        this.square(523, 0.25, 8, 0);
        this.square(659, 0.25, 8, 0.05);
        this.square(784, 0.25, 8, 0.1);
    }
    unlock() {
        this.square(392, 0.3, 8, 0);
        this.square(494, 0.3, 8, 0.06);
        this.square(587, 0.3, 8, 0.12);
    }
    error() {
        this.square(120, 0.3, 5, 0);
        this.square(90, 0.3, 5, 0.05);
    }
    damage() {
        this.noise(0.35, 5, 0);
        this.square(140, 0.2, 4, 0);
    }
    fall() {
        this.square(600, 0.25, 10, 0);
        this.square(400, 0.25, 10, 0.05);
        this.square(200, 0.25, 10, 0.1);
    }
    rise() {
        this.square(200, 0.25, 10, 0);
        this.square(400, 0.25, 10, 0.05);
        this.square(700, 0.25, 10, 0.1);
    }
    spark() {
        this.square(1200, 0.2, 6, 0);
        this.square(1600, 0.2, 6, 0.03);
        this.square(1000, 0.2, 6, 0.06);
    }
    pop() {
        this.square(700, 0.3, 5, 0);
    }
    togglerSwitch() {
        // FLASH STRIKE
        this.square(1800, 0.35, 20, 0);
        // CRYSTAL WAVE
        this.square(700, 0.25, 10, 0.07);

        // RESONANT RING
        this.square(900, 0.18, 8, 0.16);

        // DUST SETTLE
        this.noise(0.12, 4, 0.30);
    }
}
