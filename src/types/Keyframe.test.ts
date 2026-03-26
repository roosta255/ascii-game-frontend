import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Keyframe,
  isKeyframeAnimating,
  isKeyframeDuplicate,
  digestKeyframes,
  createMovePrediction,
} from './Keyframe';
import { bounce } from '../functions/Curves';
import { RoomProps } from './RoomProps';
import { TimeRef } from './TimeRef';

// ── helpers ──────────────────────────────────────────────────────────────────

function kf(animation: string, t0: number, t1: number, room0: number, data: number[]): Keyframe {
  return { animation, t0, t1, room0, data };
}

function fakeCharacter(overrides: { locationType?: string; locationData?: number; locationRoomId?: number; remainingMoves?: number } = {}) {
  return {
    remainingMoves: overrides.remainingMoves ?? 1,
    location: {
      type: overrides.locationType ?? 'FLOOR',
      data: overrides.locationData ?? 0,
      roomId: overrides.locationRoomId ?? 0,
    },
  };
}

function fakeMatch(roomId: number, floorCellOffsets: number[], wallBlockedFlags: boolean[]) {
  return {
    dungeon: {
      rooms: {
        [roomId]: {
          floorCells: floorCellOffsets.map(offset => ({ offset })),
          walls: wallBlockedFlags.map(isBlocking => ({ isBlocking })),
        },
      },
    },
  };
}

function fakeTimes(serverToClientOffset = 0): TimeRef {
  return { serverToClientOffset, lastServerTime: 0, lastClientTime: 0, fetchTime: 0 };
}

// Mirrors applyClientKeyframesToCharacter from MatchRenderer
function applyPredictions(predictedMoves: Keyframe[], character: { keyframes: Keyframe[] }) {
  if (predictedMoves.length === 0) return character;
  return {
    ...character,
    keyframes: [
      ...predictedMoves,
      ...character.keyframes.filter(k => !isKeyframeDuplicate(predictedMoves[0], 10000, k)),
    ],
  };
}

// ── isKeyframeAnimating ───────────────────────────────────────────────────────

describe('isKeyframeAnimating', () => {
  it('returns true when animationTime is within [t0, t1]', () => {
    expect(isKeyframeAnimating(kf('WALKING_FROM_FLOOR_TO_FLOOR', 1000, 2000, 0, []), 1500)).toBe(true);
  });

  it('returns true at exactly t1 (boundary is inclusive)', () => {
    expect(isKeyframeAnimating(kf('WALKING_FROM_FLOOR_TO_FLOOR', 1000, 2000, 0, []), 2000)).toBe(true);
  });

  // isKeyframeAnimating only checks t1, not t0 — a keyframe is considered active
  // from the start of time until t1. This is the current implementation behaviour.
  it('returns true even before t0 (only t1 is checked)', () => {
    expect(isKeyframeAnimating(kf('WALKING_FROM_FLOOR_TO_FLOOR', 1000, 2000, 0, []), 999)).toBe(true);
  });

  it('returns false after t1', () => {
    expect(isKeyframeAnimating(kf('WALKING_FROM_FLOOR_TO_FLOOR', 1000, 2000, 0, []), 2001)).toBe(false);
  });

  it('returns false for NIL animation regardless of time', () => {
    expect(isKeyframeAnimating(kf('NIL', 0, 99999, 0, []), 1000)).toBe(false);
  });
});

// ── isKeyframeDuplicate ───────────────────────────────────────────────────────

describe('isKeyframeDuplicate', () => {
  it('matches when animation and destination (data[2]) are the same', () => {
    const source = kf('WALKING_FROM_FLOOR_TO_FLOOR', 1000, 2100, 0, [0, 0, 5, 0]);
    const target = kf('WALKING_FROM_FLOOR_TO_FLOOR', 1050, 2150, 0, [0, 0, 5, 0]);
    expect(isKeyframeDuplicate(source, 10000, target)).toBe(true);
  });

  it('does not match when destination differs', () => {
    const source = kf('WALKING_FROM_FLOOR_TO_FLOOR', 1000, 2100, 0, [0, 0, 5, 0]);
    const target = kf('WALKING_FROM_FLOOR_TO_FLOOR', 1050, 2150, 0, [0, 0, 6, 0]);
    expect(isKeyframeDuplicate(source, 10000, target)).toBe(false);
  });

  it('does not match when animation type differs', () => {
    const source = kf('WALKING_FROM_FLOOR_TO_FLOOR', 1000, 2100, 0, [0, 0, 5, 0]);
    const target = kf('WALKING_FROM_WALL_TO_FLOOR', 1050, 2150, 0, [0, 0, 5, 0]);
    expect(isKeyframeDuplicate(source, 10000, target)).toBe(false);
  });

  // Documents current behaviour: the timeout param is accepted but not used.
  // If you re-enable the time-bound check, this test will need updating.
  it('matches regardless of how far apart in time the keyframes are (timeout is currently ignored)', () => {
    const source = kf('WALKING_FROM_FLOOR_TO_FLOOR', 0, 1100, 0, [0, 0, 3, 0]);
    const target = kf('WALKING_FROM_FLOOR_TO_FLOOR', 999999, 1001100, 0, [0, 0, 3, 0]);
    expect(isKeyframeDuplicate(source, 10000, target)).toBe(true);
  });
});

// ── createMovePrediction ──────────────────────────────────────────────────────

describe('createMovePrediction', () => {
  let nowMs: number;

  beforeEach(() => {
    nowMs = 5000;
    vi.spyOn(globalThis.performance, 'now').mockImplementation(() => nowMs);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const MOVE_DURATION = 1100;
  const STAND_DURATION = 6000;

  it('returns [] when character has no remaining moves', () => {
    const result = createMovePrediction(0, 3, undefined, fakeCharacter({ remainingMoves: 0 }), fakeMatch(0, [-1, -1, -1, -1], [false, false, false, false]), fakeTimes());
    expect(result).toHaveLength(0);
  });

  it('returns [] when both floorId and direction are undefined', () => {
    const result = createMovePrediction(0, undefined, undefined, fakeCharacter(), fakeMatch(0, [-1], [false, false, false, false]), fakeTimes());
    expect(result).toHaveLength(0);
  });

  it('returns [] when both floorId and direction are defined', () => {
    const result = createMovePrediction(0, 3, 2, fakeCharacter(), fakeMatch(0, [-1, -1, -1, -1], [false, false, false, false]), fakeTimes());
    expect(result).toHaveLength(0);
  });

  it('returns [] when target floor cell is occupied', () => {
    // -1 = empty, anything else = occupied. Cell 0 has offset 42 (occupied).
    const match = fakeMatch(0, [42], [false, false, false, false]);
    const result = createMovePrediction(0, 0, undefined, fakeCharacter(), match, fakeTimes());
    expect(result).toHaveLength(0);
  });

  it('returns [] when target wall is blocking', () => {
    const match = fakeMatch(0, [-1, -1, -1, -1], [false, false, true, false]); // direction 2 blocked
    const result = createMovePrediction(0, undefined, 2, fakeCharacter(), match, fakeTimes());
    expect(result).toHaveLength(0);
  });

  describe('floor-to-floor move (character at FLOOR location)', () => {
    // 4 empty cells (-1 = empty), targeting cell index 3
    const emptyRoom = () => fakeMatch(0, [-1, -1, -1, -1], [false, false, false, false]);

    it('returns [move, stand] for a floor prediction', () => {
      const character = fakeCharacter({ locationType: 'FLOOR', locationData: 1 });
      const result = createMovePrediction(0, 3, undefined, character, emptyRoom(), fakeTimes(0));

      expect(result).toHaveLength(2);
    });

    it('move keyframe has correct animation, timing, and endpoints', () => {
      const character = fakeCharacter({ locationType: 'FLOOR', locationData: 1 });
      const result = createMovePrediction(0, 3, undefined, character, emptyRoom(), fakeTimes(0));

      const [move] = result;
      expect(move.animation).toBe('WALKING_FROM_FLOOR_TO_FLOOR');
      expect(move.t0).toBe(nowMs);          // animationTime = now - offset (offset=0)
      expect(move.t1).toBe(nowMs + MOVE_DURATION);
      expect(move.room0).toBe(0);
      expect(move.data[0]).toBe(1);         // source = location.data
      expect(move.data[2]).toBe(3);         // destination = floorId
    });

    it('stand keyframe immediately follows move and lasts STAND_DURATION', () => {
      const character = fakeCharacter({ locationType: 'FLOOR', locationData: 1 });
      const result = createMovePrediction(0, 3, undefined, character, emptyRoom(), fakeTimes(0));

      const [move, stand] = result;
      expect(stand.animation).toBe('STANDING_AT_FLOOR');
      expect(stand.t0).toBe(move.t1);
      expect(stand.t1).toBe(move.t1 + STAND_DURATION);
      expect(stand.data[2]).toBe(3);        // standing at destination
    });

    it('animationTime is adjusted by serverToClientOffset', () => {
      const offset = 200;
      const character = fakeCharacter({ locationType: 'FLOOR', locationData: 1 });
      const result = createMovePrediction(0, 3, undefined, character, emptyRoom(), fakeTimes(offset));

      const [move] = result;
      expect(move.t0).toBe(nowMs - offset);
    });
  });

  describe('floor-to-door move (character at FLOOR location)', () => {
    it('returns only [move] for a door prediction (no stand)', () => {
      const match = fakeMatch(0, [], [false, false, false, false]);
      const character = fakeCharacter({ locationType: 'FLOOR', locationData: 0 });
      const result = createMovePrediction(0, undefined, 2, character, match, fakeTimes(0));

      expect(result).toHaveLength(1);
      expect(result[0].animation).toBe('WALKING_FROM_FLOOR_TO_WALL');
      expect(result[0].data[2]).toBe(2); // direction = destination
    });
  });

  describe('door-to-floor move (character at DOOR location)', () => {
    const emptyRoom = () => fakeMatch(0, [-1, -1, -1, -1], [false, false, false, false]);

    it('uses WALKING_FROM_WALL_TO_FLOOR when starting at a DOOR', () => {
      const character = fakeCharacter({ locationType: 'DOOR', locationData: 1 });
      const result = createMovePrediction(0, 3, undefined, character, emptyRoom(), fakeTimes(0));

      expect(result[0].animation).toBe('WALKING_FROM_WALL_TO_FLOOR');
    });

    it('uses WALKING_FROM_WALL_TO_FLOOR when starting at SHAFT_BOTTOM', () => {
      const character = fakeCharacter({ locationType: 'SHAFT_BOTTOM', locationData: 1 });
      const result = createMovePrediction(0, 3, undefined, character, emptyRoom(), fakeTimes(0));

      expect(result[0].animation).toBe('WALKING_FROM_WALL_TO_FLOOR');
    });
  });

  describe('DOOR_SHARED location', () => {
    it('flips source direction when character is coming from the adjacent room side', () => {
      // roomId=1, but character.location.roomId=0 => source is opposite door
      const match = fakeMatch(1, [-1, -1, -1, -1], [false, false, false, false]);
      const character = fakeCharacter({ locationType: 'DOOR_SHARED', locationData: 0, locationRoomId: 0 });
      const result = createMovePrediction(1, 3, undefined, character, match, fakeTimes(0));

      expect(result[0].animation).toBe('WALKING_FROM_WALL_TO_FLOOR');
      // direction 0 opposite is (0+2)%4 = 2
      expect(result[0].data[0]).toBe(2);
    });

    it('keeps source direction when already in the target room', () => {
      const match = fakeMatch(0, [-1, -1, -1, -1], [false, false, false, false]);
      const character = fakeCharacter({ locationType: 'DOOR_SHARED', locationData: 1, locationRoomId: 0 });
      const result = createMovePrediction(0, 3, undefined, character, match, fakeTimes(0));

      expect(result[0].data[0]).toBe(1); // unchanged
    });
  });
});

// ── queue merging (applyClientKeyframesToCharacter logic) ─────────────────────

describe('queue merging', () => {
  it('prepends predicted keyframes before server keyframes', () => {
    const predicted = [kf('WALKING_FROM_FLOOR_TO_FLOOR', 1000, 2100, 0, [1, 0, 3, 0])];
    const character = { keyframes: [kf('WALKING_FROM_FLOOR_TO_FLOOR', 1080, 2180, 0, [1, 0, 3, 0])] };

    const result = applyPredictions(predicted, character);

    expect(result.keyframes[0]).toEqual(predicted[0]);
    expect(result.keyframes).toHaveLength(1); // server duplicate filtered
  });

  it('keeps server keyframes that go to a different destination', () => {
    const predicted = [kf('WALKING_FROM_FLOOR_TO_FLOOR', 1000, 2100, 0, [1, 0, 3, 0])];
    const character = {
      keyframes: [
        kf('WALKING_FROM_FLOOR_TO_FLOOR', 1080, 2180, 0, [1, 0, 3, 0]), // duplicate
        kf('WALKING_FROM_FLOOR_TO_FLOOR', 2180, 3280, 0, [3, 0, 5, 0]), // next move, kept
      ],
    };

    const result = applyPredictions(predicted, character);

    expect(result.keyframes).toHaveLength(2);
    expect(result.keyframes[1].data[2]).toBe(5);
  });

  it('passes character through unchanged when predictedMoves is empty', () => {
    const character = { keyframes: [kf('STANDING_AT_FLOOR', 0, 6000, 0, [3, 0, 3, 0])] };
    const result = applyPredictions([], character);
    expect(result).toBe(character);
  });

  it('handles multiple queued predicted moves', () => {
    const predicted = [
      kf('WALKING_FROM_FLOOR_TO_FLOOR', 1000, 2100, 0, [0, 0, 3, 0]),
      kf('STANDING_AT_FLOOR', 2100, 8100, 0, [3, 0, 3, 0]),
    ];
    const character = { keyframes: [] };

    const result = applyPredictions(predicted, character);

    expect(result.keyframes[0].data[2]).toBe(3); // move arrives at 3
    expect(result.keyframes[1].animation).toBe('STANDING_AT_FLOOR');
  });
});

// ── async server response timing scenarios ────────────────────────────────────

describe('async server response timing', () => {
  const START = 1000;
  const MOVE_DURATION = 1100;
  const STAND_DURATION = 6000;

  const move = kf('WALKING_FROM_FLOOR_TO_FLOOR', START, START + MOVE_DURATION, 0, [0, 0, 3, 0]);
  const stand = kf('STANDING_AT_FLOOR', START + MOVE_DURATION, START + MOVE_DURATION + STAND_DURATION, 0, [3, 0, 3, 0]);

  // NOTE: isKeyframeAnimating only checks t1 >= animationTime, not t0.
  // Both move and stand are therefore "active" for any time before their t1,
  // including times before the keyframe nominally starts.

  it('fast server response: move is still animating when server confirms', () => {
    const serverResponseAt = START + 300; // 300ms into a 1100ms move
    expect(isKeyframeAnimating(move, serverResponseAt)).toBe(true);
    // stand.t1 is far in the future, so it also passes the t1 check
    expect(isKeyframeAnimating(stand, serverResponseAt)).toBe(true);
  });

  it('normal server response: server confirms during stand window', () => {
    const serverResponseAt = START + MOVE_DURATION + 500; // 500ms into stand (t=2600)
    // move.t1 = 2100 < 2600 — move is done
    expect(isKeyframeAnimating(move, serverResponseAt)).toBe(false);
    // stand.t1 = START + MOVE_DURATION + STAND_DURATION = 8100 >= 2600 — stand active
    expect(isKeyframeAnimating(stand, serverResponseAt)).toBe(true);
  });

  it('move expires once animationTime exceeds move.t1', () => {
    const afterMove = START + MOVE_DURATION + 1; // 1ms after move ends
    expect(isKeyframeAnimating(move, afterMove)).toBe(false);
    expect(isKeyframeAnimating(stand, afterMove)).toBe(true);
  });

  it('slow server response: stand has expired before server confirms', () => {
    const serverResponseAt = START + MOVE_DURATION + STAND_DURATION + 1000;
    expect(isKeyframeAnimating(move, serverResponseAt)).toBe(false);
    expect(isKeyframeAnimating(stand, serverResponseAt)).toBe(false);
  });

  it('server rejection: clearing predicted moves removes all predicted keyframes', () => {
    const predicted = [move, stand];
    const character = { keyframes: [] };

    let result = applyPredictions(predicted, character);
    expect(result.keyframes).toHaveLength(2);

    // Server rejects — predictedMoves cleared
    result = applyPredictions([], character);
    expect(result.keyframes).toHaveLength(0);
  });

  it('server confirms during move: server duplicate is still filtered by destination match', () => {
    const predicted = [move, stand];
    // Server sends the same move with slightly different timing
    const serverConfirmedMove = kf('WALKING_FROM_FLOOR_TO_FLOOR', START + 80, START + MOVE_DURATION + 80, 0, [0, 0, 3, 0]);
    const character = { keyframes: [serverConfirmedMove] };

    const result = applyPredictions(predicted, character);

    // Server duplicate should be filtered; only predicted keyframes remain
    expect(result.keyframes.filter(k => k === serverConfirmedMove)).toHaveLength(0);
    expect(result.keyframes[0]).toBe(move);
  });

  it('server sends follow-up move after the predicted destination: both kept', () => {
    const predicted = [move, stand];
    const serverNextMove = kf('WALKING_FROM_FLOOR_TO_FLOOR', START + MOVE_DURATION + 500, START + MOVE_DURATION + 1600, 0, [3, 0, 7, 0]);
    const character = { keyframes: [serverNextMove] };

    const result = applyPredictions(predicted, character);

    // predicted[0] (move to 3) does not match serverNextMove (move to 7) — both kept
    expect(result.keyframes).toHaveLength(3); // move, stand, serverNextMove
    expect(result.keyframes[2].data[2]).toBe(7);
  });
});

// ── bounce curve ──────────────────────────────────────────────────────────────

describe('bounce curve', () => {
  it('at ratio=0 returns source (start)', () => {
    expect(bounce(10, 30, 0)).toBeCloseTo(10, 5);
  });

  it('at ratio=0.5 returns destination (peak)', () => {
    expect(bounce(10, 30, 0.5)).toBeCloseTo(30, 5);
  });

  it('at ratio=1 returns source (full return)', () => {
    expect(bounce(10, 30, 1)).toBeCloseTo(10, 5);
  });

  it('at ratio=0.25 is between source and destination', () => {
    const v = bounce(10, 30, 0.25);
    expect(v).toBeGreaterThan(10);
    expect(v).toBeLessThan(30);
  });

  it('is symmetric: value at ratio r equals value at ratio 1-r', () => {
    expect(bounce(0, 100, 0.2)).toBeCloseTo(bounce(0, 100, 0.8), 5);
  });
});

// ── digestKeyframes bounce animations ─────────────────────────────────────────
//
// Helper: evaluate the rendered position for the active keyframe digest,
// mirroring the Math.floor(curve(source, dest, ratio)) logic in AnimatedCharacter.
function evalPos(
  keyframes: Keyframe[],
  animationTime: number,
  room: RoomProps,
  fallback?: [number, number]
): [number, number] {
  const d = digestKeyframes(keyframes, animationTime, room, fallback);
  const ratio = d.t1 > d.t0 ? (animationTime - d.t0) / (d.t1 - d.t0) : 0;
  return [
    Math.floor(d.curve(d.source[0], d.destination[0], ratio)),
    Math.floor(d.curve(d.source[1], d.destination[1], ratio)),
  ];
}

// ── RECT_4_x_5 south-lock regression ──────────────────────────────────────────
// Exact data from public/rooms.json "RECT_4_x_5", room placed at origin.
//
// cells.offset=[8,8]  cells.stride=[6,5]
// walls[0] N: door=[14, 3] lock=[26, 3]
// walls[1] E: door=[32,18] lock=[32, 8]
// walls[2] S: door=[14,33] lock=[26,33]  ← target
// walls[3] W: door=[ 2,18] lock=[ 2, 8]
//
// floor cell 0: [0*6+0+8, 0*5+0+8] = [8, 8]
// south lock:   [26, 33]
// north door:   [14,  3]

describe('digestKeyframes bounce — RECT_4_x_5 south lock', () => {
  const T0 = 0;
  const T1 = 2000;
  const MID = 1000; // ratio=0.5 → peak

  const rect4x5: RoomProps = {
    index: 0,
    position: [0, 0],
    size: [4, 5],
    cells: {
      stride: [6, 5],
      offset: [8, 8],
      walls: [
        { door: { offset: [14,  3] }, lock: { offset: [26,  3] } }, // N
        { door: { offset: [32, 18] }, lock: { offset: [32,  8] } }, // E
        { door: { offset: [14, 33] }, lock: { offset: [26, 33] } }, // S
        { door: { offset: [ 2, 18] }, lock: { offset: [ 2,  8] } }, // W
      ],
    },
  };

  // FROM_FLOOR: character on floor cell 0, bouncing toward south lock (dir=2)
  it('FROM_FLOOR: at start returns floor cell 0 position [8,8]', () => {
    const kfs = [kf('DOOR_LOCK_BOUNCE_FROM_FLOOR', T0, T1, 0, [0, 2])];
    expect(evalPos(kfs, T0, rect4x5)).toEqual([8, 8]);
  });

  it('FROM_FLOOR: at peak (ratio=0.5) reaches south lock [26,33]', () => {
    const kfs = [kf('DOOR_LOCK_BOUNCE_FROM_FLOOR', T0, T1, 0, [0, 2])];
    expect(evalPos(kfs, MID, rect4x5)).toEqual([26, 33]);
  });

  it('FROM_FLOOR: after expiry lastExpiredPosition is source [8,8], not lock [26,33]', () => {
    const kfs = [kf('DOOR_LOCK_BOUNCE_FROM_FLOOR', T0, T1, 0, [0, 2])];
    // animationTime after t1: digest falls through to lastExpiredPosition
    expect(evalPos(kfs, T1 + 1, rect4x5)).toEqual([8, 8]);
  });

  // FROM_DOOR: character at north door (dir=0), bouncing toward south lock (dir=2)
  it('FROM_DOOR: at start returns north door position [14,3]', () => {
    const kfs = [kf('DOOR_LOCK_BOUNCE_FROM_DOOR', T0, T1, 0, [0, 2])];
    expect(evalPos(kfs, T0, rect4x5)).toEqual([14, 3]);
  });

  it('FROM_DOOR: at peak reaches south lock [26,33]', () => {
    const kfs = [kf('DOOR_LOCK_BOUNCE_FROM_DOOR', T0, T1, 0, [0, 2])];
    expect(evalPos(kfs, MID, rect4x5)).toEqual([26, 33]);
  });

  it('FROM_DOOR: after expiry lastExpiredPosition is source [14,3], not lock [26,33]', () => {
    const kfs = [kf('DOOR_LOCK_BOUNCE_FROM_DOOR', T0, T1, 0, [0, 2])];
    expect(evalPos(kfs, T1 + 1, rect4x5)).toEqual([14, 3]);
  });
});

// ── RECT_2_x_5 east and south lock regression ─────────────────────────────────
// Exact data from public/rooms.json "RECT_2_x_5", room placed at origin.
//
// cells.offset=[14,8]  cells.stride=[6,5]
// walls[0] N: door=[17, 3]              no lock
// walls[1] E: door=[26,18] lock=[26, 8] ← east lock
// walls[2] S: door=[17,33]              no lock → falls back to door pos
// walls[3] W: door=[ 8,18] lock=[ 8, 8]
//
// floor cell 0: [0*6+0+14, 0*5+0+8] = [14, 8]

describe('digestKeyframes bounce — RECT_2_x_5 east and south', () => {
  const T0 = 0;
  const T1 = 2000;
  const MID = 1000;

  const rect2x5: RoomProps = {
    index: 0,
    position: [0, 0],
    size: [2, 5],
    cells: {
      stride: [6, 5],
      offset: [14, 8],
      walls: [
        { door: { offset: [17,  3] }                                }, // N  no lock
        { door: { offset: [26, 18] }, lock: { offset: [26,  8] } }, // E
        { door: { offset: [17, 33] }                                }, // S  no lock
        { door: { offset: [ 8, 18] }, lock: { offset: [ 8,  8] } }, // W
      ],
    },
  };

  // East lock (dir=1): lock exists at [26,8]
  it('east lock: at peak reaches lock position [26,8]', () => {
    const kfs = [kf('DOOR_LOCK_BOUNCE_FROM_FLOOR', T0, T1, 0, [0, 1])];
    expect(evalPos(kfs, MID, rect2x5)).toEqual([26, 8]);
  });

  it('east lock: at start returns floor cell 0 position [14,8]', () => {
    const kfs = [kf('DOOR_LOCK_BOUNCE_FROM_FLOOR', T0, T1, 0, [0, 1])];
    expect(evalPos(kfs, T0, rect2x5)).toEqual([14, 8]);
  });

  // South (dir=2): no lock — falls back to door position [17,33]
  it('south (no lock): at peak falls back to door position [17,33]', () => {
    const kfs = [kf('DOOR_LOCK_BOUNCE_FROM_FLOOR', T0, T1, 0, [0, 2])];
    expect(evalPos(kfs, MID, rect2x5)).toEqual([17, 33]);
  });

  it('south (no lock): at start returns floor cell 0 position [14,8]', () => {
    const kfs = [kf('DOOR_LOCK_BOUNCE_FROM_FLOOR', T0, T1, 0, [0, 2])];
    expect(evalPos(kfs, T0, rect2x5)).toEqual([14, 8]);
  });
});
