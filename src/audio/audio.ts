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

    playSquare(freq: number, volume = 0.3, decay = 6) {
        console.log("ChipSynth.playSquare");
        this.init();
        this.resume();
        this.post({ type: "play", wave: "square", freq, volume, decay });
    }

    playNoise(volume = 0.3, decay = 6) {
        this.post({ type: "play", wave: "noise", volume, decay });
    }
}
