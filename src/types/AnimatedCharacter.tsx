import { blockToText } from "../functions/blockToText";
import { digestKeyframes, Keyframe, KeyframeDigest } from "./Keyframe";
import { DrawerProps } from "../types/DrawerProps";
import { RoomProps, toFloorGlyphsFromCell, toFloorGlyphsFromDoor } from "../types/RoomProps";

export interface AnimatedCharacterProps {
    character: any;
    animationTime: number;
    globals: DrawerProps;
    room: RoomProps;
}

export function AnimatedCharacter({
  character,
  animationTime,
  globals,
  room,
  drawSprite,
}: {
  character: any;
  animationTime: number;
  globals: DrawerProps;
  room: RoomProps;
  drawSprite?: (globals: DrawerProps) => void;
}) {
  const keyframe = digestKeyframes(character.keyframes, animationTime, room);

  const progress =
    (animationTime - keyframe.t0) / (keyframe.t1 - keyframe.t0);

  // interpolate room-space position
  const [x0, y0] = keyframe.source;
  const [x1, y1] = keyframe.destination;
  const x = Math.floor(keyframe.curve(x0, x1, progress));
  const y = Math.floor(keyframe.curve(y0, y1, progress));

  if (drawSprite) {
    drawSprite(globals);
  } else {
    globals.painters.roles.draw(character.role, {globals, locals: {coords: [0, 0]}});
  }

  return (
    <div
      className="animated-character"
      style={{
        position: "absolute",
        left: `${x}ch`,
        top: `${y}em`,
        pointerEvents: "none",
      }}
    >
      {blockToText(globals.glyphs)}
    </div>
  );
}
