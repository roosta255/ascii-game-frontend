import { RoomProps, toFloorGlyphsFromCell, toFloorGlyphsFromDoor } from "./RoomProps";
import { lerp, skip } from "../functions/Curves";
import { TimeRef } from "./TimeRef";

export interface Keyframe {
  animation: string;
  t0: number;
  t1: number;
  room0: number;
  data: number[];
  predicted?: boolean;
}

interface KeyframeDigest {
  source: [number, number];
  destination: [number, number];
  t0: number;
  t1: number;
  curve: (before: number, after: number, ratio: number) => number;
};

export function isKeyframeAnimating(keyframe: Keyframe, animationTime: number): boolean {
  return keyframe.animation !== "NIL" && keyframe.t1 >= animationTime;
}

export function digestKeyframes(keyframes: Keyframe[], animationTime: number, room: RoomProps, defaultPosition?: [number, number]): KeyframeDigest {
  // animations are a list of keyframes, but if overlapping, then some blending is required
  // say a character has 2 animations, where are they rendered in between?
  // * all animations should determine whether animationTime is within them.
  // what if those animations are overlapping? where then are they rendered?
  var digest: KeyframeDigest | null = null;
  // Fallback: destination of the most recently expired movement keyframe.
  // Used when only a non-movement keyframe (e.g. a transition animation) is active.
  var lastExpiredPosition: [number, number] | null = null;
  var lastExpiredT1 = -Infinity;

  // find current animation
  // else,

  for (var k of keyframes) {
    // skip animations in rooms not rendering:
    if (k.room0 !== room.index) continue;

    // animationTime >= k.t0 && animationTime < k.t1
    function getKeyframeMovement(): [[number, number], [number, number], (before: number, after: number, ratio: number) => number] | null {
      switch(k.animation) {
        case "WALKING_FROM_WALL_TO_WALL": return [
          toFloorGlyphsFromDoor(room, k.data[0]),
          toFloorGlyphsFromDoor(room, k.data[1]),
          lerp];
        case "WALKING_FROM_WALL_TO_FLOOR": return [
          toFloorGlyphsFromDoor(room, k.data[0]),
          toFloorGlyphsFromCell(room, k.data[1]),
          lerp];
        case "WALKING_FROM_FLOOR_TO_WALL": return [
          toFloorGlyphsFromCell(room, k.data[0]),
          toFloorGlyphsFromDoor(room, k.data[1]),
          lerp];
        case "WALKING_FROM_FLOOR_TO_FLOOR": return [
          toFloorGlyphsFromCell(room, k.data[0]),
          toFloorGlyphsFromCell(room, k.data[1]),
          lerp];
        case "STANDING_AT_DOOR": return [
          toFloorGlyphsFromDoor(room, k.data[1]),
          toFloorGlyphsFromDoor(room, k.data[1]),
          skip];
        case "STANDING_AT_FLOOR": return [
          toFloorGlyphsFromCell(room, k.data[1]),
          toFloorGlyphsFromCell(room, k.data[1]),
          skip];
      }
      return null;
    }

    let movement = getKeyframeMovement();

    if (!movement) continue;

    let [xy0, xy1, curve] = movement;

    if (animationTime >= k.t0 && animationTime < k.t1) {
      // currently animating this movement
      digest = { source: xy0, destination: xy1, t0: k.t0, t1: k.t1, curve };
    } else if (animationTime >= k.t1 && k.t1 > lastExpiredT1) {
      // track the most recently expired movement so non-movement animations
      // (e.g. transition animations) can still render at the correct position
      lastExpiredPosition = xy1;
      lastExpiredT1 = k.t1;
    }

  }

  if (digest) return digest;

  // No active movement keyframe — use the last known position if available
  // (covers the case where only a transition animation keyframe is active)
  const fallback = lastExpiredPosition ?? defaultPosition ?? [0, 0];
  return { source: fallback, destination: fallback, t0: 0, t1: 1, curve: skip };
}

export function isKeyframeDuplicate(source: Keyframe, timeout: number, target: Keyframe): boolean {
  return target.animation == source.animation && target.data[1] == source.data[1];
  // |--------------|source.t1|timeout|source.t1+timeout|----------------
  // |--------------------------------------------------------||--------- <- safe
  // |---------------------------------------------|target.t0|--------- <- duplicate
  // return target.animation == source.animation && source.t1 + timeout >= target.t0;
}

// ── Stat prediction keyframes ─────────────────────────────────────────────────
// These track predicted changes to character stats (moves/actions remaining).
// They are kept separate from movement keyframes so they don't trigger the
// AnimatedCharacter overlay. data = [from, 0, to, 0].

export function predictedMovesRemaining(base: number, pending: Keyframe[]): number {
  return base - pending.filter(k => k.animation === 'MOVE_DECREMENT').length;
}

export function predictedActionsRemaining(base: number, pending: Keyframe[]): number {
  return base - pending.filter(k => k.animation === 'ACTION_DECREMENT').length;
}

export function createMoveDecrementPrediction(baseMoves: number, pending: Keyframe[], times: TimeRef): Keyframe {
  const from = predictedMovesRemaining(baseMoves, pending);
  const t = performance.now() - times.serverToClientOffset;
  return { animation: 'MOVE_DECREMENT', t0: t, t1: t + 1100, room0: -1, data: [from, Math.max(0, from - 1)], predicted: true };
}

export function createActionDecrementPrediction(baseActions: number, pending: Keyframe[], times: TimeRef): Keyframe {
  const from = predictedActionsRemaining(baseActions, pending);
  const t = performance.now() - times.serverToClientOffset;
  return { animation: 'ACTION_DECREMENT', t0: t, t1: t + 1100, room0: -1, data: [from, Math.max(0, from - 1)], predicted: true };
}

export function createMovePrediction(roomId: number, floorId: number | undefined, direction: number | undefined, character: any, match: any, times: TimeRef, startTime?: number): Keyframe[] {
    // check the moves
    if (character.remainingMoves <= 0) {
        return [];
    }

    const isFloorPrediction = floorId !== undefined;
    const isDoorPrediction = direction !== undefined;
    if (!isFloorPrediction && !isDoorPrediction) {
        console.log(`Failed to predict move, floorId and direction cannot both be undefined`);
        return [];
    }

    if (isFloorPrediction && isDoorPrediction) {
        console.log(`Failed to predict move, floorId and direction cannot both be defined`);
        return [];
    }

    const room = match.dungeon.rooms[roomId];
    if (room === undefined) {
        console.log(`Failed to predict move, room ${roomId} not found within match.dungeon.rooms[]`);
        return [];
    }

    // check the floor occupancy
    if (isFloorPrediction && room.floorCells[floorId].offset != -1) {
        console.log(`Failed to predict move, floor ${floorId} not found within match.dungeon.rooms[${roomId}].floorCells`);
        return [];
    }

    // check the door blockage for doors
    if (isDoorPrediction && room.walls[direction].isBlocking) {
        console.log(`Failed to predict move, wall is blocking within match.dungeon.rooms[${roomId}].walls[${direction}]`);
        return [];
    }

    // roomId is where the animation should be.
    // character.location might be a shared wall of an adjacent room.
    // detecting that exactly would mean checking the animation room's adjacency
    // but it can also be deduced by checking against the current room.
    var animation: string | undefined = undefined;
    const location = character.location;
    var source: number = location.data;
    function setDooredAnimation(){
      animation = isFloorPrediction ? "WALKING_FROM_WALL_TO_FLOOR" : isDoorPrediction ? "WALKING_FROM_WALL_TO_WALL" : undefined;
    }
    function doorOpposite(input: number): number {
      return (input + 2) % 4;
    }
    switch (location.type) {
      case "DOOR_SHARED":
        if (roomId != location.roomId) {
          source = doorOpposite(source);
        }
      case "DOOR":
      case "SHAFT_BOTTOM":
      case "SHAFT_TOP":
        setDooredAnimation();
        break;
      case "FLOOR":
        animation = isFloorPrediction ? "WALKING_FROM_FLOOR_TO_FLOOR" : isDoorPrediction ? "WALKING_FROM_FLOOR_TO_WALL" : undefined;
        break;
      default:
        console.log(`Failed to predict move, unrecognized character.location.type ${location.type}`);
        return [];
    }

    if (animation === undefined) {
      return [];
    }

    var destination: number = isFloorPrediction ? floorId : isDoorPrediction ? direction : 0;

    const animationTime = startTime ?? (performance.now() - times.serverToClientOffset);

    const MOVE_DURATION = 1100;
    const STAND_DURATION = 6000;
    const move: Keyframe = {
      animation,
      t0: animationTime,
      t1: animationTime + MOVE_DURATION,
      room0: roomId,
      data: [source, destination],
      predicted: true,
    };
    var animationStanding: string | undefined = isFloorPrediction ? "STANDING_AT_FLOOR" : isDoorPrediction ? "STANDING_AT_DOOR" : undefined;
    if (animationStanding === undefined) {
      console.log(`Failed to predict standing, due to neither door nor floor prediction ${location.type}`);
      return [move];
    }
    const stand: Keyframe = {
      animation: animationStanding,
      t0: animationTime + MOVE_DURATION,
      t1: animationTime + MOVE_DURATION + STAND_DURATION,
      room0: roomId,
      data: [destination, destination],
      predicted: true,
    };
    // console.log(stand);
    return isFloorPrediction ? [move, stand] : [move];
}
