import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  Keyframe,
  isKeyframeAnimating,
  isKeyframeDuplicate,
  createMovePrediction,
} from './Keyframe';
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
