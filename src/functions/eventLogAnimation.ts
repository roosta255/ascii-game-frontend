export const FADE_DURATION = 5000;
export const HIGHLIGHT_COLOR = 0xffff88;
export const NORMAL_COLOR   = 0xaaaaaa;

export function lerpColor(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    const r  = Math.round(ar + (br - ar) * t);
    const g  = Math.round(ag + (bg - ag) * t);
    const b2 = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | b2;
}

export function computeFade(timeAdded: number, now: number, duration: number = FADE_DURATION): number {
    return Math.min(1, (now - timeAdded) / duration);
}

export const ACTION_LABELS: Record<string, string> = {
    SHIFTER_LOCK: 'lock',
    KEEPER_LOCK: 'lock',
    MOVE_TO_DOOR: 'move to',
};

export function resolveAction(action: string): string {
    return ACTION_LABELS[action] ?? action.toLowerCase().replace(/_/g, ' ');
}

export function computeEventLogRows(
    eventLog: unknown[],
    toSentence: (event: unknown) => string,
    capacity: number = 8,
    width: number = 39,
): number {
    const visible = eventLog.slice(-capacity);
    let rows = 2; // header + separator
    for (const event of visible) {
        rows += Math.ceil(toSentence(event).length / width) + 1;
    }
    return Math.max(rows, 3);
}

export function makeEventKey(event: { index: number }): string {
    return String(event.index);
}

export function syncEventTimestamps(
    visible: { index: number }[],
    timestamps: Map<string, number>,
    now: number,
): void {
    const currentKeys = new Set<string>();
    for (const event of visible) {
        const key = makeEventKey(event);
        currentKeys.add(key);
        if (!timestamps.has(key)) {
            timestamps.set(key, now);
        }
    }
    for (const key of timestamps.keys()) {
        if (!currentKeys.has(key)) timestamps.delete(key);
    }
}
