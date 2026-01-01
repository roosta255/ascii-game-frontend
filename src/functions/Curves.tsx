
export function lerp(before: number, after: number, ratio: number): number {
    return before + (after - before) * ratio;
}

export function skip(before: number, after: number, ratio: number): number {
    return after;
}
