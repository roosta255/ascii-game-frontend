import React, { useEffect, useState } from "react";
import { loadXp, AsciiGlyph } from "./loadXp";
import { Texture } from "./assets/Texture";
import { Painter } from "./assets/Painter";

export interface MatchRendererProps {
  match: any;
  viewedRoomId: number;
  setViewedRoomId: (id: number) => void;
}

function intToCssColor(color: number): string {
  return "#" + color.toString(16).padStart(6, "0");
}

function blockToText(block: AsciiGlyph[][]): JSX.Element {
  return (
    <>
      {block.map((row, y) => (
        <div key={y} style={{ lineHeight: 1, whiteSpace: "pre" }}>
          {row.map((glyph, x) => (
            <span
              key={x}
              onClick={() => glyph.onClick?.(x, y)}
              style={{
                color: intToCssColor(glyph.fg),
                backgroundColor: intToCssColor(glyph.bg),
                cursor: glyph.onClick ? "pointer" : "default",
              }}
            >
              {glyph.char}
            </span>
          ))}
        </div>
      ))}
    </>
  );
}

export function createBlankCanvas(width: number, height: number): AsciiGlyph[][] {
  const blankGlyph: AsciiGlyph = { char: " ", fg: 0, bg: 0 };
  return Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ ...blankGlyph }))
  );
}

function getAllCharacters(match: any): any[] {
  const dungeonChars = match.dungeon?.characters ?? [];
  const builderChars = match.builders?.map((b: any) => b.character) ?? [];
  const allCharacters = [...dungeonChars, ...builderChars];
  // console.log("Character offsets:", allCharacters.map(m => m.offset));
  return allCharacters;
}

export default function MatchRenderer({ match, viewedRoomId, setViewedRoomId }: MatchRendererProps) {
  const [backgroundTexture, setBackgroundTexture] = useState<Texture | null>(null);
  const [spriteMeta, setSpriteMeta] = useState<any>(null);
  const [rolePainter, setRolePainter] = useState<Painter | null>(null);
  const [doorPainter, setDoorPainter] = useState<Painter | null>(null);
  const [iconsTexture, setIconsTexture] = useState<Texture | null>(null);

  useEffect(() => {
    document.fonts.load("16px 'RexPaintFont'").then(() => {
      console.log("✅ RexPaintFont loaded");
    });

    fetch(`${import.meta.env.BASE_URL}knossos-2025-room.json`)
      .then(res => res.json())
      .then(meta =>
        fetch(`${import.meta.env.BASE_URL}${meta.path}`)
          .then(res => res.arrayBuffer())
          .then(loadXp)
          .then(layers => setBackgroundTexture(new Texture(layers[0], meta)))
      )
      .catch(err => console.error("❌ Failed to load background:", err));

    fetch(`${import.meta.env.BASE_URL}icons.json`)
      .then(res => res.json())
      .then(meta => {
        setSpriteMeta(meta);
        return fetch(`${import.meta.env.BASE_URL}${meta.path}`)
          .then(res => res.arrayBuffer())
          .then(loadXp)
          .then(layers => setIconsTexture(new Texture(layers[0], meta)));
      })
      .catch(err => console.error("❌ Failed to load icons:", err));

    Painter.load(`${import.meta.env.BASE_URL}roles.json`)
      .then(setRolePainter)
      .catch(err => console.error("❌ Failed to load roles.json:", err));

    Painter.load(`${import.meta.env.BASE_URL}doors.json`)
      .then(setDoorPainter)
      .catch(err => console.error("❌ Failed to load doors.json:", err));
  }, []);

  if (!backgroundTexture || !iconsTexture || !spriteMeta || !match || !rolePainter || !doorPainter) {
    return <pre>Loading...</pre>;
  }

  const globals = {
    textures: {
      icons: iconsTexture,
      rooms: backgroundTexture,
    },
    glyphs: createBlankCanvas(60, 42),
  };

  const room = match.dungeon.rooms[viewedRoomId];
  // console.log("🧭 Rendering room ID:", viewedRoomId, room);
  const offsetMap = Object.fromEntries(getAllCharacters(match).map((c: any) => [c.offset, c]));
  const BUILDER_ID = 0;
  const account = match.builders[BUILDER_ID].player.account;
  const builderOffset = match.builders[BUILDER_ID].character.offset;

  function markRegionClickable(
    startX: number,
    startY: number,
    width: number,
    height: number,
    onClick: () => void
  ) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const gx = startX + x;
        const gy = startY + y;
        if (globals.glyphs[gy]?.[gx]) {
          globals.glyphs[gy][gx].onClick = () => onClick();
        }
      }
    }
  }

  function drawRoomAt(roomX: number, roomY: number, room: any, roomId: number) {

    // console.log("Rendering roomid: ", roomId);

    function drawCharacterAt(drawX: number, drawY: number, cell: any) {
      const character = cell.offset && offsetMap[cell.offset];
      if (!character) return;
      const onClick = async () => {
        try {
          const subject = character.isObject ? builderOffset : cell.offset;
          const activateBody = { account, room: roomId, character: cell.offset, target: subject };
          const response = await fetch(`/api/match/${match.filename}/activate_character`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(activateBody),
          });
          if (!response.ok) {
            console.warn(`Failed to activate character, body: ${activateBody}`);
            console.error("Failed to activate character, response:", await response.text());
          } else {
            console.log("Character activated");
          }
        } catch (error) {
          console.error("Error activating character:", error);
        }
      };
      // if (cell.offset == 168) {
      //   console.log("Drawing role: ", character.role);
      // }
      rolePainter.draw(character.role, {globals, locals: {coords: [drawX, drawY], onClick}});
    }

    backgroundTexture.draw(globals.glyphs, "BOARD", roomX, roomY, 16);
    const DOOR_PALETTE_OFFSET = 1;
    const doorPalette = DOOR_PALETTE_OFFSET +
      (room.walls[0].isDoorway ? 1 : 0) +
      (room.walls[1].isDoorway ? 2 : 0) +
      (room.walls[2].isDoorway ? 4 : 0) +
      (room.walls[3].isDoorway ? 8 : 0);
    backgroundTexture.draw(globals.glyphs, "DOORWAY", roomX, roomY, doorPalette);

    const FLOOR_OFFSET_X = 8;
    const FLOOR_OFFSET_Y = 8;
    const CELL_STRIDE_X = 6;
    const CELL_STRIDE_Y = 5;
    const CELL_SIZE_X = 5;
    const CELL_SIZE_Y = 4;
    function toFloorGlyphs(cellX: number, cellY: number): [number, number] {
      return [
        cellX * CELL_STRIDE_X + roomX + FLOOR_OFFSET_X,
        cellY * CELL_STRIDE_Y + roomY + FLOOR_OFFSET_Y,
      ];
    }

    function setClickableFloor(drawX: number, drawY: number, floor: number) {
      markRegionClickable(drawX, drawY, CELL_SIZE_X, CELL_SIZE_Y, () => {
        const moveBody = { account, character: builderOffset, room: roomId, floor };
        fetch(`/api/match/${match.filename}/move_character`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(moveBody),
        })
          .then(async res => {
            const bodyText = await res.text();
            if (!res.ok) {
              console.info(`❌ HTTP ${res.status} request: `, moveBody);
              console.error(`❌ HTTP ${res.status} response: `, bodyText);
              throw new Error(`HTTP ${res.status}`);
            }
            try {
              console.log("✅ Move success:", JSON.parse(bodyText));
            } catch {
              console.warn("⚠️ Non-JSON response:", bodyText);
            }
          })
          .catch(err => console.error("❌ Move failed:", err));
      });
    }

    var i = 0;
    for (const cell of room.floorCells) {
      const [drawX, drawY] = toFloorGlyphs(cell.x, cell.y);
      const character = cell.offset && offsetMap[cell.offset];
      if (!character) {
        setClickableFloor(drawX, drawY, i);
      } else {
        drawCharacterAt(drawX, drawY, cell);
      }
      i++;
    }

    function setClickableDoorway(drawX: number, drawY: number, direction: number) {
      markRegionClickable(drawX, drawY, CELL_SIZE_X, CELL_SIZE_Y, () => {
        const moveBody = { account, character: builderOffset, room: roomId, direction };
        fetch(`/api/match/${match.filename}/move_character`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(moveBody),
        })
          .then(async res => {
            const bodyText = await res.text();
            if (!res.ok) {
              console.info(`❌ HTTP ${res.status} request: `, moveBody);
              console.error(`❌ HTTP ${res.status} response: `, bodyText);
              throw new Error(`HTTP ${res.status}`);
            }
            try {
              console.log("✅ Move success:", JSON.parse(bodyText));
            } catch {
              console.warn("⚠️ Non-JSON response:", bodyText);
            }

            // 🚀 Immediately switch room if doorway leads to adjacent room
            const wall = room.walls[direction];
            if (wall.adjacent != null && wall.adjacent !== viewedRoomId) {
              console.log(`🚪 Moving view to adjacent room ${wall.adjacent}`);
              setViewedRoomId(wall.adjacent);
            }
          })
          .catch(err => console.error("❌ Move failed:", err));
      });
    }

    // Example door interactions
    let [dx, dy] = toFloorGlyphs(1, -1);
    drawCharacterAt(dx, dy, room.walls[0].cell);
    doorPainter.draw(room.walls[0].door, {globals, locals: {coords: [dx, dy], direction: 0}});
    setClickableDoorway(dx, dy, 0);

    [dx, dy] = toFloorGlyphs(4, 2);
    drawCharacterAt(dx, dy, room.walls[1].cell);
    doorPainter.draw(room.walls[1].door, {globals, locals: {coords: [dx, dy], direction: 0}});
    setClickableDoorway(dx, dy, 1);

    [dx, dy] = toFloorGlyphs(1, 5);
    drawCharacterAt(dx, dy, room.walls[2].cell);
    doorPainter.draw(room.walls[2].door, {globals, locals: {coords: [dx, dy], direction: 0}});
    setClickableDoorway(dx, dy, 2);

    [dx, dy] = toFloorGlyphs(-1, 2);
    drawCharacterAt(dx, dy, room.walls[3].cell);
    doorPainter.draw(room.walls[3].door, {globals, locals: {coords: [dx, dy], direction: 0}});
    setClickableDoorway(dx, dy, 3);
  }

  drawRoomAt(0, 0, room, viewedRoomId);

  return <pre>{blockToText(globals.glyphs)}</pre>;
}
