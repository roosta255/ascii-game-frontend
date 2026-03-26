import { describe, it, expect } from 'vitest';
import {
    FADE_DURATION,
    HIGHLIGHT_COLOR,
    NORMAL_COLOR,
    lerpColor,
    computeFade,
    makeEventKey,
    syncEventTimestamps,
    resolveAction,
    computeEventLogRows,
} from './eventLogAnimation';
import { buildEventSentence } from './buildEventSentence';

// ── lerpColor ─────────────────────────────────────────────────────────────────

describe('lerpColor', () => {
    it('returns the first color at t=0', () => {
        expect(lerpColor(0xff0000, 0x0000ff, 0)).toBe(0xff0000);
    });

    it('returns the second color at t=1', () => {
        expect(lerpColor(0xff0000, 0x0000ff, 1)).toBe(0x0000ff);
    });

    it('blends each channel independently at t=0.5', () => {
        const result = lerpColor(0xff0000, 0x0000ff, 0.5);
        const r = (result >> 16) & 0xff;
        const g = (result >> 8)  & 0xff;
        const b =  result        & 0xff;
        expect(r).toBe(128); // Math.round(255 * 0.5)
        expect(g).toBe(0);
        expect(b).toBe(128); // Math.round(255 * 0.5)
    });

    it('interpolates from highlight to normal at t=0.5', () => {
        const result = lerpColor(HIGHLIGHT_COLOR, NORMAL_COLOR, 0.5);
        const expectedR = Math.round(((HIGHLIGHT_COLOR >> 16) & 0xff) * 0.5 + ((NORMAL_COLOR >> 16) & 0xff) * 0.5);
        expect((result >> 16) & 0xff).toBe(expectedR);
    });
});

// ── computeFade ───────────────────────────────────────────────────────────────

describe('computeFade', () => {
    it('is 0 immediately after the event is added', () => {
        const now = 10000;
        expect(computeFade(now, now)).toBe(0);
    });

    it('is 1 when the full duration has elapsed', () => {
        const timeAdded = 10000;
        expect(computeFade(timeAdded, timeAdded + FADE_DURATION)).toBe(1);
    });

    it('clamps to 1 after the duration has passed', () => {
        const timeAdded = 10000;
        expect(computeFade(timeAdded, timeAdded + FADE_DURATION * 2)).toBe(1);
    });

    it('is 0.5 halfway through the duration', () => {
        const timeAdded = 10000;
        expect(computeFade(timeAdded, timeAdded + FADE_DURATION / 2)).toBe(0.5);
    });

    it('accepts a custom duration', () => {
        const timeAdded = 0;
        expect(computeFade(timeAdded, 250, 500)).toBe(0.5);
    });
});

// ── makeEventKey ──────────────────────────────────────────────────────────────

describe('makeEventKey', () => {
    it('returns the string form of the event index', () => {
        expect(makeEventKey({ index: 5 })).toBe('5');
        expect(makeEventKey({ index: 0 })).toBe('0');
    });

    it('produces different keys for different indices', () => {
        expect(makeEventKey({ index: 0 })).not.toBe(makeEventKey({ index: 1 }));
    });

    // Fix: previously used JSON.stringify which was sensitive to property insertion
    // order — same logical event with different field ordering produced different keys,
    // re-triggering the highlight. Now the key is derived solely from event.index,
    // which is stable regardless of field ordering.
    it('produces the same key for the same index regardless of other field order', () => {
        const e1 = { index: 0, action: 'LOCK', actor: 'builder' };
        const e2 = { index: 0, actor: 'builder', action: 'LOCK' };
        expect(makeEventKey(e1)).toBe(makeEventKey(e2));
    });
});

// ── syncEventTimestamps ───────────────────────────────────────────────────────

describe('syncEventTimestamps', () => {
    const event = (index: number, action: string) => ({ index, action });
    const T0 = 1000;

    it('registers a new event with the current timestamp', () => {
        const timestamps = new Map<string, number>();
        syncEventTimestamps([event(0, 'LOCK')], timestamps, T0);
        expect(timestamps.size).toBe(1);
        expect(timestamps.get(makeEventKey(event(0, 'LOCK')))).toBe(T0);
    });

    it('does not overwrite the timestamp for an existing event', () => {
        const timestamps = new Map<string, number>();
        const e = event(0, 'LOCK');

        syncEventTimestamps([e], timestamps, T0);
        syncEventTimestamps([e], timestamps, T0 + 999);

        expect(timestamps.get(makeEventKey(e))).toBe(T0);
    });

    it('evicts events that are no longer visible', () => {
        const timestamps = new Map<string, number>();
        const e0 = event(0, 'LOCK');
        const e1 = event(1, 'MOVE');

        syncEventTimestamps([e0, e1], timestamps, T0);
        expect(timestamps.size).toBe(2);

        const e2 = event(2, 'BITE');
        syncEventTimestamps([e1, e2], timestamps, T0 + 100);

        expect(timestamps.has(makeEventKey(e0))).toBe(false);
        expect(timestamps.has(makeEventKey(e1))).toBe(true);
        expect(timestamps.has(makeEventKey(e2))).toBe(true);
    });

    it('only the newly added event gets the latest timestamp', () => {
        const timestamps = new Map<string, number>();
        const e0 = event(0, 'LOCK');
        const e1 = event(1, 'MOVE');

        syncEventTimestamps([e0], timestamps, T0);
        syncEventTimestamps([e0, e1], timestamps, T0 + 500);

        expect(timestamps.get(makeEventKey(e0))).toBe(T0);       // unchanged
        expect(timestamps.get(makeEventKey(e1))).toBe(T0 + 500); // new
    });

    it('at capacity: oldest evicted, newest registered, rest unchanged', () => {
        const timestamps = new Map<string, number>();
        const events = Array.from({ length: 8 }, (_, i) => event(i, `ACTION_${i}`));

        syncEventTimestamps(events, timestamps, T0);

        const newEvent = event(8, 'ACTION_8');
        const nextVisible = [...events.slice(1), newEvent];
        syncEventTimestamps(nextVisible, timestamps, T0 + 1000);

        // events[0] evicted
        expect(timestamps.has(makeEventKey(events[0]))).toBe(false);
        // events[1..7] still have original timestamps
        for (let i = 1; i < 8; i++) {
            expect(timestamps.get(makeEventKey(events[i]))).toBe(T0);
        }
        // new event registered at T0+1000
        expect(timestamps.get(makeEventKey(newEvent))).toBe(T0 + 1000);
    });

    it('clears to empty when given an empty visible list', () => {
        const timestamps = new Map<string, number>();
        syncEventTimestamps([event(0, 'LOCK')], timestamps, T0);
        syncEventTimestamps([], timestamps, T0 + 100);
        expect(timestamps.size).toBe(0);
    });
});

// ── resolveAction ─────────────────────────────────────────────────────────────

describe('resolveAction', () => {
    it('maps SHIFTER_LOCK to its base verb', () => {
        expect(resolveAction('SHIFTER_LOCK')).toBe('lock');
    });

    it('maps KEEPER_LOCK to its base verb', () => {
        expect(resolveAction('KEEPER_LOCK')).toBe('lock');
    });

    it('maps MOVE_TO_DOOR to its base verb phrase', () => {
        expect(resolveAction('MOVE_TO_DOOR')).toBe('move to');
    });

    it('humanises unknown action codes as a fallback', () => {
        expect(resolveAction('CRITTER_BITE')).toBe('critter bite');
    });
});

// ── computeEventLogRows (mobile canvas height) ────────────────────────────────
//
// Regression: ACTION_LABELS was a const inside the React component body.
// computeEventLogRows was called during canvas size calculation (before that
// line executed), causing a TDZ ReferenceError → black screen on mobile when
// the Log panel was opened. The fix moved ACTION_LABELS to module scope.

describe('computeEventLogRows — mobile canvas height regression', () => {
    // Minimal sentence builder that exercises the full resolveAction path,
    // mirroring what MatchRenderer passes as eventToSentence.
    function toSentence(event: unknown): string {
        const e = event as any;
        const action = resolveAction(e.action);
        const actor = e.actor.name.toLowerCase();
        const tool = e.tool?.name.toLowerCase();
        const target = e.target?.name.toLowerCase();
        return buildEventSentence({ actor, action, tool, target, direction: e.direction?.toLowerCase() });
    }

    const sampleLog = [
        { index: 0, action: 'SHIFTER_LOCK', actor: { name: 'BUILDER', typename: 'ROLE' }, direction: 'EAST',  target: { name: 'SHIFTER_EGRESS_KEYED', typename: 'DOOR' }, tool: { name: 'KEY', typename: 'ITEM' } },
        { index: 1, action: 'KEEPER_LOCK',  actor: { name: 'BUILDER', typename: 'ROLE' }, direction: 'SOUTH', target: { name: 'KEEPER_INGRESS_KEYLESS', typename: 'DOOR' }, tool: { name: 'KEY', typename: 'ITEM' } },
        { index: 2, action: 'MOVE_TO_DOOR', actor: { name: 'BUILDER', typename: 'ROLE' }, direction: 'SOUTH', target: { name: 'KEEPER_INGRESS_KEYED', typename: 'DOOR' } },
        { index: 3, action: 'KEEPER_LOCK',  actor: { name: 'BUILDER', typename: 'ROLE' }, direction: 'SOUTH', target: { name: 'KEEPER_INGRESS_KEYED', typename: 'DOOR' },  tool: { name: 'KEY', typename: 'ITEM' } },
        { index: 4, action: 'KEEPER_LOCK',  actor: { name: 'BUILDER', typename: 'ROLE' }, direction: 'WEST',  target: { name: 'KEEPER_INGRESS_KEYLESS', typename: 'DOOR' }, tool: { name: 'KEY', typename: 'ITEM' } },
        { index: 5, action: 'MOVE_TO_DOOR', actor: { name: 'BUILDER', typename: 'ROLE' }, direction: 'WEST',  target: { name: 'KEEPER_INGRESS_KEYED', typename: 'DOOR' } },
    ];

    it('does not throw when given events with known action codes', () => {
        expect(() => computeEventLogRows(sampleLog, toSentence)).not.toThrow();
    });

    it('returns a positive integer for a non-empty log', () => {
        const rows = computeEventLogRows(sampleLog, toSentence);
        expect(rows).toBeGreaterThan(0);
        expect(Number.isInteger(rows)).toBe(true);
    });

    it('returns the minimum header height for an empty log', () => {
        expect(computeEventLogRows([], toSentence)).toBe(3);
    });

    it('returns more rows for more events', () => {
        const oneEvent  = computeEventLogRows(sampleLog.slice(0, 1), toSentence);
        const sixEvents = computeEventLogRows(sampleLog, toSentence);
        expect(sixEvents).toBeGreaterThan(oneEvent);
    });

    it('caps at capacity — adding events beyond capacity does not grow the height', () => {
        const baseEvent = sampleLog[0];
        const eightEvents = Array.from({ length: 8 }, () => baseEvent);
        const atCapacity   = computeEventLogRows(eightEvents, toSentence, 8);
        const overCapacity = computeEventLogRows([...eightEvents, baseEvent, baseEvent], toSentence, 8);
        expect(overCapacity).toBe(atCapacity);
    });
});

// ── mobile panel first-open rendering bug ────────────────────────────────────
//
// Bug: drawEventLogAt is only called when the Log panel is visible. The
// timestamps map starts empty. On the first render after the user taps "Log",
// syncEventTimestamps sees every event in room.eventLog as new and stamps them
// all with the current time — so all historical events highlight simultaneously.
//
// A correct implementation would distinguish pre-existing events (already in the
// log before the panel opened) from truly new arrivals, and only highlight the
// latter. The tests below document the current (buggy) behaviour so that any
// future fix can be verified against them.

describe('mobile panel first-open rendering bug', () => {
    const T_PANEL_OPEN = 60_000; // panel opened 60 s after room entry

    const oldEvents = [
        { index: 0, action: 'SHIFTER_LOCK', actor: { name: 'BUILDER', typename: 'ROLE' }, direction: 'EAST',  target: { name: 'SHIFTER_EGRESS_KEYED', typename: 'DOOR' }, tool: { name: 'KEY', typename: 'ITEM' } },
        { index: 1, action: 'KEEPER_LOCK',  actor: { name: 'BUILDER', typename: 'ROLE' }, direction: 'SOUTH', target: { name: 'KEEPER_INGRESS_KEYLESS', typename: 'DOOR' }, tool: { name: 'KEY', typename: 'ITEM' } },
        { index: 2, action: 'MOVE_TO_DOOR', actor: { name: 'BUILDER', typename: 'ROLE' }, direction: 'WEST',  target: { name: 'KEEPER_INGRESS_KEYED', typename: 'DOOR' } },
    ];

    it('all pre-existing events are stamped as new when the panel first opens', () => {
        // Simulates the state of eventLogTimestampsRef when showEventLog first
        // becomes true: the map is empty because drawEventLogAt was never called.
        const timestamps = new Map<string, number>();

        syncEventTimestamps(oldEvents, timestamps, T_PANEL_OPEN);

        // Every event receives a timestamp of T_PANEL_OPEN, not some earlier time.
        for (const e of oldEvents) {
            expect(timestamps.get(makeEventKey(e))).toBe(T_PANEL_OPEN);
        }
    });

    it('fade factor is 0 for all pre-existing events on the first frame — they all highlight', () => {
        const timestamps = new Map<string, number>();
        syncEventTimestamps(oldEvents, timestamps, T_PANEL_OPEN);

        // On the very first frame after opening, now === T_PANEL_OPEN.
        for (const e of oldEvents) {
            const timeAdded = timestamps.get(makeEventKey(e))!;
            expect(computeFade(timeAdded, T_PANEL_OPEN)).toBe(0);
        }
    });

    it('all pre-existing events render as highlight color on the first frame', () => {
        const timestamps = new Map<string, number>();
        syncEventTimestamps(oldEvents, timestamps, T_PANEL_OPEN);

        for (const e of oldEvents) {
            const fade = computeFade(timestamps.get(makeEventKey(e))!, T_PANEL_OPEN);
            expect(lerpColor(HIGHLIGHT_COLOR, NORMAL_COLOR, fade)).toBe(HIGHLIGHT_COLOR);
        }
    });

    it('a genuinely new event and a pre-existing event are indistinguishable on first open', () => {
        const timestamps = new Map<string, number>();
        const newEvent = { index: 3, action: 'KEEPER_LOCK', actor: { name: 'BUILDER', typename: 'ROLE' }, direction: 'NORTH', target: { name: 'KEEPER_EGRESS_KEYED', typename: 'DOOR' }, tool: { name: 'KEY', typename: 'ITEM' } };

        syncEventTimestamps([...oldEvents, newEvent], timestamps, T_PANEL_OPEN);

        // Both an event from minutes ago and a brand-new event share the same
        // timestamp — there is no signal to tell them apart.
        expect(timestamps.get(makeEventKey(oldEvents[0]))).toBe(timestamps.get(makeEventKey(newEvent)));
    });
});

// ── fade → color integration ──────────────────────────────────────────────────

describe('fade to color integration', () => {
    it('new event renders as highlight color (fade=0)', () => {
        const fade = computeFade(1000, 1000);
        expect(lerpColor(HIGHLIGHT_COLOR, NORMAL_COLOR, fade)).toBe(HIGHLIGHT_COLOR);
    });

    it('fully faded event renders as normal color (fade=1)', () => {
        const fade = computeFade(1000, 1000 + FADE_DURATION);
        expect(lerpColor(HIGHLIGHT_COLOR, NORMAL_COLOR, fade)).toBe(NORMAL_COLOR);
    });

    it('event past its fade duration is indistinguishable from normal color', () => {
        const fade = computeFade(0, FADE_DURATION * 10);
        expect(lerpColor(HIGHLIGHT_COLOR, NORMAL_COLOR, fade)).toBe(NORMAL_COLOR);
    });
});

// ── no-highlight bug: events missing index field ───────────────────────────────
//
// Bug: after switching makeEventKey to use event.index, new events stopped
// highlighting entirely. Root cause: if the server does not send an index field,
// event.index is undefined and makeEventKey returns the string 'undefined' for
// every event. All events share one key, so any new event finds its key already
// in the timestamps map and inherits the old (already-fading) timestamp instead
// of getting a fresh one. Events that have been in the log for > FADE_DURATION
// never highlight at all.

describe('no-highlight bug — events missing index field', () => {
    const T0 = 1000;

    it('events without an index field all produce the same key', () => {
        const e1 = { action: 'LOCK' } as any;
        const e2 = { action: 'MOVE' } as any;
        expect(makeEventKey(e1)).toBe(makeEventKey(e2));
        expect(makeEventKey(e1)).toBe('undefined');
    });

    it('a new event whose key collides with an existing entry inherits the old timestamp', () => {
        const timestamps = new Map<string, number>();
        const oldEvent = { action: 'LOCK' } as any;

        // Old event seen at T0
        syncEventTimestamps([oldEvent], timestamps, T0);

        // New event arrives 2 s later — it should get T0+2000, but key is 'undefined' too
        const newEvent = { action: 'MOVE' } as any;
        syncEventTimestamps([oldEvent, newEvent], timestamps, T0 + 2000);

        // The new event's timestamp is T0, not T0+2000 — it will never fully highlight
        expect(timestamps.get(makeEventKey(newEvent))).toBe(T0);
    });

    it('a new event with a colliding key is already fading on the frame it arrives', () => {
        const timestamps = new Map<string, number>();
        const oldEvent = { action: 'LOCK' } as any;

        syncEventTimestamps([oldEvent], timestamps, T0);

        const T_NEW = T0 + 2000; // 2 s later
        const newEvent = { action: 'MOVE' } as any;
        syncEventTimestamps([oldEvent, newEvent], timestamps, T_NEW);

        // fade = 2000 / 5000 = 0.4 — already 40 % through the animation
        const fade = computeFade(timestamps.get(makeEventKey(newEvent))!, T_NEW);
        expect(fade).toBeGreaterThan(0);
        expect(lerpColor(HIGHLIGHT_COLOR, NORMAL_COLOR, fade)).not.toBe(HIGHLIGHT_COLOR);
    });

    it('a new event whose predecessor faded > FADE_DURATION ago renders as normal color immediately', () => {
        const timestamps = new Map<string, number>();
        const oldEvent = { action: 'LOCK' } as any;

        // Old event was stamped a long time ago
        syncEventTimestamps([oldEvent], timestamps, T0);

        // New event arrives after the full fade window has elapsed
        const T_NEW = T0 + FADE_DURATION + 1000;
        const newEvent = { action: 'MOVE' } as any;
        syncEventTimestamps([oldEvent, newEvent], timestamps, T_NEW);

        const fade = computeFade(timestamps.get(makeEventKey(newEvent))!, T_NEW);
        expect(fade).toBe(1);
        expect(lerpColor(HIGHLIGHT_COLOR, NORMAL_COLOR, fade)).toBe(NORMAL_COLOR);
    });
});
