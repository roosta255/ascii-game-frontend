
export function lerp(before: number, after: number, ratio: number): number {
    return before + (after - before) * ratio;
}

export function skip(before: number, after: number, ratio: number): number {
    return after;
}

// Moves from `before` toward `after`, peaks at ratio=0.5, then returns to `before`.
export function bounce(before: number, after: number, ratio: number): number {
    return before + (after - before) * Math.sin(Math.PI * ratio);
}
