let audioCtx: AudioContext | null = null;

export function bootstrapAudio() {
  // if already done, do nothing
  if (audioCtx) return;

  audioCtx = new AudioContext();

  // THIS LINE MUST NOT BE ASYNC
  audioCtx.resume();

  console.log("audio resumed, state =", audioCtx.state);
}
