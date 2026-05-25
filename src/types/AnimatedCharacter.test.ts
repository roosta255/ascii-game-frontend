import { describe, it, expect } from 'vitest';
import { resolveTraitActive } from './AnimatedCharacter';
import { Keyframe } from './Keyframe';

function kf(animation: string, t0: number, t1: number, data: number[]): Keyframe {
  return { animation, t0, t1, room0: 0, data };
}

// ── resolveTraitActive — no keyframes ─────────────────────────────────────────

describe('resolveTraitActive — no relevant keyframes', () => {
  it('returns true when trait is in traitsComputed', () => {
    expect(resolveTraitActive('SLEEP', [], ['SLEEP'], 1000)).toBe(true);
  });

  it('returns false when trait is absent from traitsComputed', () => {
    expect(resolveTraitActive('SLEEP', [], [], 1000)).toBe(false);
  });

  it('ignores unrelated keyframes and defers to traitsComputed', () => {
    expect(resolveTraitActive('SLEEP', [kf('ENCHAIN', 0, 800, [0, 1])], ['SLEEP'], 1000)).toBe(true);
    expect(resolveTraitActive('SLEEP', [kf('ENCHAIN', 0, 800, [0, 1])], [], 1000)).toBe(false);
  });
});

// ── resolveTraitActive — single keyframe ─────────────────────────────────────

describe('resolveTraitActive — single keyframe (turn ON: data=[0,1])', () => {
  const kfs = [kf('SLEEP', 500, 1300, [0, 1])];

  it('returns data[0]=0 (off) before the keyframe starts', () => {
    expect(resolveTraitActive('SLEEP', kfs, [], 499)).toBe(false);
  });

  it('returns data[1]=1 (on) exactly at t0', () => {
    expect(resolveTraitActive('SLEEP', kfs, [], 500)).toBe(true);
  });

  it('returns data[1]=1 (on) during the keyframe', () => {
    expect(resolveTraitActive('SLEEP', kfs, [], 900)).toBe(true);
  });

  it('returns data[1]=1 (on) after the keyframe ends', () => {
    expect(resolveTraitActive('SLEEP', kfs, [], 1300)).toBe(true);
  });

  it('ignores traitsComputed when a keyframe is present — trait absent but keyframe says on', () => {
    expect(resolveTraitActive('SLEEP', kfs, [], 900)).toBe(true);
  });
});

describe('resolveTraitActive — single keyframe (turn OFF: data=[1,0])', () => {
  const kfs = [kf('SLEEP', 500, 1300, [1, 0])];

  it('returns data[0]=1 (on) before the keyframe starts', () => {
    expect(resolveTraitActive('SLEEP', kfs, [], 499)).toBe(true);
  });

  it('returns data[1]=0 (off) at and after t0', () => {
    expect(resolveTraitActive('SLEEP', kfs, [], 500)).toBe(false);
    expect(resolveTraitActive('SLEEP', kfs, [], 1300)).toBe(false);
  });

  it('ignores traitsComputed when a keyframe is present — trait present but keyframe says off after t0', () => {
    expect(resolveTraitActive('SLEEP', kfs, ['SLEEP'], 600)).toBe(false);
  });
});

// ── resolveTraitActive — multiple keyframes ───────────────────────────────────

describe('resolveTraitActive — multiple keyframes, picks latest by t1', () => {
  it('uses the keyframe with the highest t1', () => {
    const kfs = [
      kf('SLEEP', 0,    800,  [0, 1]),  // earlier keyframe: turn ON
      kf('SLEEP', 1000, 1800, [1, 0]),  // later keyframe:   turn OFF
    ];
    // before both start — first keyframe not started, but we only look at the one with max t1
    // max t1 is 1800, t0=1000; at t=500: t < 1000, so data[0]=1 (on)
    expect(resolveTraitActive('SLEEP', kfs, [], 500)).toBe(true);
    // at t=1200: t >= 1000, so data[1]=0 (off)
    expect(resolveTraitActive('SLEEP', kfs, [], 1200)).toBe(false);
  });

  it('latest keyframe turning ON overrides earlier turn-OFF', () => {
    const kfs = [
      kf('SLEEP', 0,    800,  [1, 0]),  // earlier: turn OFF
      kf('SLEEP', 1000, 1800, [0, 1]),  // later:   turn ON
    ];
    // t < 1000: data[0]=0 (off) from latest keyframe
    expect(resolveTraitActive('SLEEP', kfs, [], 500)).toBe(false);
    // t >= 1000: data[1]=1 (on) from latest keyframe
    expect(resolveTraitActive('SLEEP', kfs, [], 1500)).toBe(true);
  });
});

// ── resolveTraitActive — edge: t exactly at t0 ───────────────────────────────

describe('resolveTraitActive — boundary at t0', () => {
  it('t === t0 is treated as "after start" and uses data[1]', () => {
    const kfs = [kf('ENCHAIN', 1000, 2000, [0, 1])];
    expect(resolveTraitActive('ENCHAIN', kfs, [], 1000)).toBe(true);
  });
});

// ── resolveTraitActive — stale keyframe (t > t1) falls back to traitsComputed ─

describe('resolveTraitActive — stale keyframe after t1 defers to traitsComputed', () => {
  it('stale turn-ON keyframe does not override absent traitsComputed', () => {
    // Regression: old PIETY turn-ON keyframe should not force eye color on indefinitely
    const kfs = [kf('PIETY', 1000, 1800, [0, 1])];
    expect(resolveTraitActive('PIETY', kfs, [], 99999)).toBe(false);
  });

  it('stale turn-ON keyframe still returns true when traitsComputed confirms it', () => {
    const kfs = [kf('PIETY', 1000, 1800, [0, 1])];
    expect(resolveTraitActive('PIETY', kfs, ['PIETY'], 99999)).toBe(true);
  });

  it('stale turn-OFF keyframe does not suppress an active traitsComputed entry', () => {
    const kfs = [kf('SLEEP', 1000, 1800, [1, 0])];
    expect(resolveTraitActive('SLEEP', kfs, ['SLEEP'], 99999)).toBe(true);
  });

  it('exactly at t1 still uses data[1], not traitsComputed', () => {
    const kfs = [kf('SLEEP', 500, 1300, [0, 1])];
    expect(resolveTraitActive('SLEEP', kfs, [], 1300)).toBe(true);
  });

  it('one tick past t1 defers to traitsComputed', () => {
    const kfs = [kf('SLEEP', 500, 1300, [0, 1])];
    expect(resolveTraitActive('SLEEP', kfs, [], 1301)).toBe(false);
    expect(resolveTraitActive('SLEEP', kfs, ['SLEEP'], 1301)).toBe(true);
  });
});

// ── resolveTraitActive — eye-color traits behave identically ─────────────────

describe('resolveTraitActive — eye-color traits (PIETY, MAGICAL, UNHOLY)', () => {
  it('PIETY with no keyframe defers to traitsComputed', () => {
    expect(resolveTraitActive('PIETY', [], ['PIETY'], 500)).toBe(true);
    expect(resolveTraitActive('PIETY', [], [], 500)).toBe(false);
  });

  it('PIETY keyframe turning on overrides missing traitsComputed', () => {
    const kfs = [kf('PIETY', 200, 1000, [0, 1])];
    expect(resolveTraitActive('PIETY', kfs, [], 300)).toBe(true);
  });

  it('UNHOLY keyframe turning off overrides present traitsComputed', () => {
    const kfs = [kf('UNHOLY', 200, 1000, [1, 0])];
    expect(resolveTraitActive('UNHOLY', kfs, ['UNHOLY'], 300)).toBe(false);
  });
});

