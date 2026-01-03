import { RoomProps, toFloorGlyphsFromCell, toFloorGlyphsFromDoor } from "./RoomProps";
import { lerp, skip } from "../functions/Curves";

export interface Keyframe {
  animation: string;
  t0: number;
  t1: number;
  room0: number;
  data: number[];
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

export function digestKeyframes(keyframes: Keyframe[], animationTime: number, room: RoomProps): KeyframeDigest {
  // animations are a list of keyframes, but if overlapping, then some blending is required
  // say a character has 2 animations, where are they rendered in between?
  // * all animations should determine whether animationTime is within them.
  // what if those animations are overlapping? where then are they rendered?
  var digest: KeyframeDigest = {
    source: [0, 0],
    destination: [0, 0],
    t0: 0,
    t1: 1,
    curve: skip,
  };

  // find current animation
  // else, 

  for (var k of keyframes) {
    // skip animations in rooms not rendering:


    // animationTime >= k.t0 && animationTime < k.t1
    function doorOpposite(input: number): number {
      return (input + 2) % 4;
    }

    function getKeyframeMovement(): [[number, number], [number, number], (before: number, after: number, ratio: number) => number] | null {
      switch(k.animation) {
        case "WALKING_FROM_WALL_TO_WALL": return [
          toFloorGlyphsFromDoor(room, k.data[0]),
          toFloorGlyphsFromDoor(room, doorOpposite(k.data[2])),
          skip];
        case "WALKING_FROM_WALL_TO_FLOOR": return [
          toFloorGlyphsFromDoor(room, k.data[0]),
          toFloorGlyphsFromCell(room, [k.data[2], k.data[3]]),
          lerp];
        case "WALKING_FROM_FLOOR_TO_WALL": return [
          toFloorGlyphsFromCell(room, [k.data[0], k.data[1]]),
          toFloorGlyphsFromDoor(room, doorOpposite(k.data[2])),
          skip];
        case "WALKING_FROM_FLOOR_TO_FLOOR": return [
          toFloorGlyphsFromCell(room, [k.data[0], k.data[1]]),
          toFloorGlyphsFromCell(room, [k.data[2], k.data[3]]),
          lerp];
      }
      return null;
    }

    let movement = getKeyframeMovement();

    if (!movement) continue;

    let [xy0, xy1, curve] = movement;

    if (animationTime >= k.t0 && animationTime < k.t1) {
      // currently animating this movement
      digest.source = xy0;
      digest.destination = xy1;
      digest.t0 = k.t0;
      digest.t1 = k.t1;
      digest.curve = curve;
    }

  }

  return digest;
}
