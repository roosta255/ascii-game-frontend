import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { blockToText } from "./functions/blockToText";
import { Texture } from "./assets/Texture";
import { Painter } from "./assets/Painter";
import { AnimatedCharacter } from "./types/AnimatedCharacter";
import { loadXp, createBlankCanvas } from "./types/AsciiGlyph";
import { DrawerProps, rebuildGlyphs } from "./types/DrawerProps";
import { calculatePosition, GridCalculator } from "./types/GridCalculator";
import { isKeyframeAnimating, Keyframe } from "./types/Keyframe";
import { CellSize, measureCellSize } from "./types/CellSize";
import { TimeRef } from "./types/TimeRef";
import { RoomProps, toFloorGlyphsFromCell, toFloorGlyphsFromDoor, toFloorGlyphsFromLock } from "./types/RoomProps";
import "./MatchRenderer.css";

export interface MatchRendererProps {
  match: any;
  viewedRoomId: number;
  setViewedRoomId: (id: number) => void;
  timeRef: TimeRef;
  refreshMatch: () => Promise<void>;
}

function getAllCharacters(match: any): any[] {
  const dungeonChars = match.dungeon?.characters ?? [];
  const builderChars = match.builders?.map((b: any) => b.character) ?? [];
  const allCharacters = [...dungeonChars, ...builderChars];
  // console.log("Character offsets:", allCharacters.map(m => m.offset));
  return allCharacters;
}

export default function MatchRenderer({ match, viewedRoomId, setViewedRoomId, timeRef, refreshMatch }: MatchRendererProps) {
  const [backgroundTexture, setBackgroundTexture] = useState<Texture | null>(null);
  const [minimapTexture, setMinimapTexture] = useState<Texture | null>(null);
  const [spriteMeta, setSpriteMeta] = useState<any>(null);
  const [rolePainter, setRolePainter] = useState<Painter | null>(null);
  const [itemPainter, setItemPainter] = useState<Painter | null>(null);
  const [doorPainter, setDoorPainter] = useState<Painter | null>(null);
  const [lockPainter, setLockPainter] = useState<Painter | null>(null);
  const [iconsTexture, setIconsTexture] = useState<Texture | null>(null);
  const [renderTime, setRenderTime] = useState<number>(0);
  const cellSize = useRef<CellSize | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);

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

    fetch(`${import.meta.env.BASE_URL}minimap-5x4.json`)
      .then(res => res.json())
      .then(meta =>
        fetch(`${import.meta.env.BASE_URL}${meta.path}`)
          .then(res => res.arrayBuffer())
          .then(loadXp)
          .then(layers => setMinimapTexture(new Texture(layers[0], meta)))
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

    Painter.load(`${import.meta.env.BASE_URL}items.json`)
      .then(setItemPainter)
      .catch(err => console.error("❌ Failed to load items.json:", err));

    Painter.load(`${import.meta.env.BASE_URL}doors.json`)
      .then(setDoorPainter)
      .catch(err => console.error("❌ Failed to load doors.json:", err));

    Painter.load(`${import.meta.env.BASE_URL}locks.json`)
      .then(setLockPainter)
      .catch(err => console.error("❌ Failed to load locks.json:", err));
  }, []);

  // animation loop
  useEffect(() => {
    let rafId: number;
    const tick = () => {
      setRenderTime(performance.now());
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useLayoutEffect(() => {
    if (!sceneRef.current) return;
    cellSize.current = measureCellSize(sceneRef.current);
    console.log(cellSize.current);
  }, []);

  const isRenderReady = backgroundTexture && spriteMeta && itemPainter && minimapTexture && rolePainter && doorPainter && lockPainter && iconsTexture && match;
  const isAnimationReady = isRenderReady && cellSize && renderTime;

  if (!isAnimationReady) {
    return (<div ref={sceneRef} className="scene">
        <pre>Loading...</pre>
      </div>);
  }

  const roomProps: RoomProps = {
    position: [0,0],
    cells: {
      offset: [8,8],
      stride: [6,5],
      size: [5,4],
    },
    index: viewedRoomId,
  };

  const globals: DrawerProps = {
    textures: {
      icons: iconsTexture,
      rooms: backgroundTexture,
      minimap: minimapTexture,
    },
    painters: {
      doors: doorPainter,
      items: itemPainter,
      locks: lockPainter,
      roles: rolePainter,
    },
    glyphs: createBlankCanvas(80, 42),
  };

  const room = match.dungeon.rooms[viewedRoomId];
  // console.log("🧭 Rendering room ID:", viewedRoomId, room);
  const offsetMap = Object.fromEntries(getAllCharacters(match).map((c: any) => [c.offset, c]));
  const BUILDER_ID = 0;
  const account = match.builders[BUILDER_ID].player.account;
  const player = match.builders[BUILDER_ID].player;
  const builderOffset = match.builders[BUILDER_ID].character.offset;
  const times = timeRef.current;

  async function autoTurnEnding(
    isActing: boolean,
    isMoving: boolean
  ): Promise<boolean> {
    const builder = match.builders[BUILDER_ID].character;

    const shouldEndTurn =
      (isMoving && builder.movesRemaining === 0) ||
      (isActing && builder.actionsRemaining === 0);

    if (!shouldEndTurn) {
      return false;
    }

    const endTurnBody = { account };

    const res = await fetch(
      `/api/match/${match.filename}/end_turn`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(endTurnBody),
      }
    );

    const bodyText = await res.text();

    if (!res.ok) {
      console.info(`❌ HTTP ${res.status} request: `, endTurnBody);
      console.error(`❌ HTTP ${res.status} response: `, bodyText);
      throw new Error(`End turn failed (${res.status})`);
    }

    // Only refresh if the end turn succeeded
    await refreshMatch();

    console.log("✅ End Turn (auto) success");

    return true;
  }

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

    // TODO: remove global mutation
    roomProps.position = [roomX, roomY];

    function drawCharacterAt(drawX: number, drawY: number, cell: any) {
      const character = cell.offset && offsetMap[cell.offset];
      if (!character) return;
      // animations check

      if (character.keyframes.find((k:Keyframe) => isKeyframeAnimating(k, performance.now() - times.serverToClientOffset)) !== undefined) return;
      const onClick = !character.isActionable ? undefined : async () => {
        await autoTurnEnding(true, false);
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
            await refreshMatch();
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

    globals.textures.rooms.draw(globals.glyphs, "BOARD", roomX, roomY, 16);
    const DOOR_PALETTE_OFFSET = 1;
    const doorPalette = DOOR_PALETTE_OFFSET +
      (room.walls[0].isDoorway ? 1 : 0) +
      (room.walls[1].isDoorway ? 2 : 0) +
      (room.walls[2].isDoorway ? 4 : 0) +
      (room.walls[3].isDoorway ? 8 : 0);
    globals.textures.rooms.draw(globals.glyphs, "DOORWAY", roomX, roomY, doorPalette);

    const CELL_SIZE_X = 5;
    const CELL_SIZE_Y = 4;

    function setClickableFloor(drawX: number, drawY: number, floor: number) {
      markRegionClickable(drawX, drawY, CELL_SIZE_X, CELL_SIZE_Y, async () => {
        try {
          const moveBody = {
            account,
            character: builderOffset,
            room: roomId,
            floor,
          };

          // 1️⃣ End turn (refresh happens inside if needed)
          await autoTurnEnding(false, true);

          // 2️⃣ Move character (WAIT for it)
          const res = await fetch(
            `/api/match/${match.filename}/move_character`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(moveBody),
            }
          );

          const bodyText = await res.text();

          if (!res.ok) {
            console.info(`❌ HTTP ${res.status} request:`, moveBody);
            console.error(`❌ HTTP ${res.status} response:`, bodyText);
            throw new Error(`HTTP ${res.status}`);
          }

          // 3️⃣ Parse JSON only if it actually is JSON
          if (bodyText.trim().startsWith("{") || bodyText.trim().startsWith("[")) {
            console.log("✅ Move success:", JSON.parse(bodyText));
          } else {
            console.log("✅ Move success (non-JSON):", bodyText);
          }

          // 4️⃣ Refresh AFTER move completes
          await refreshMatch();

        } catch (err) {
          console.error("❌ Floor move failed:", err);
        }
      });
    }

    var i = 0;
    for (const cell of room.floorCells) {
      const [drawX, drawY] = toFloorGlyphsFromCell(roomProps, [cell.x, cell.y]);
      const character = cell.offset && offsetMap[cell.offset];
      if (!character) {
        setClickableFloor(drawX, drawY, i);
      } else {
        drawCharacterAt(drawX, drawY, cell);
      }
      i++;
    }

    function setClickableDoorway(drawX: number, drawY: number, direction: number) {
      markRegionClickable(drawX, drawY, CELL_SIZE_X, CELL_SIZE_Y, async () => {
        const moveBody = { account, character: builderOffset, room: roomId, direction };
        await autoTurnEnding(false, true);
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

            await refreshMatch();

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

    function setClickableLock(drawX: number, drawY: number, direction: number) {
      markRegionClickable(drawX, drawY, CELL_SIZE_X, CELL_SIZE_Y, async () => {
        await autoTurnEnding(true, false);
        const moveBody = { account, character: builderOffset, room: roomId, direction };
        fetch(`/api/match/${match.filename}/activate_lock`, {
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
              console.log("✅ Lock success:", JSON.parse(bodyText));
              await refreshMatch();
            } catch {
              console.warn("⚠️ Non-JSON response:", bodyText);
            }
          })
          .catch(err => console.error("❌ Move failed:", err));
      });
    }

    for (var i = 0; i < 4; i++) {
      {
        let [dx, dy] = toFloorGlyphsFromDoor(roomProps, i);
        drawCharacterAt(dx, dy, room.walls[i].cell);
        globals.painters.doors.draw(room.walls[i].door, {globals, locals: {coords: [dx, dy], direction: 0}});
        if (!room.walls[i].isBlocking && !room.walls[i].isDoorActionable) {
          setClickableDoorway(dx, dy, i);
        }
      }
      {
        let [dx, dy] = toFloorGlyphsFromLock(roomProps, i);
        globals.painters.locks.draw(room.walls[i].door, {globals, locals: {coords: [dx, dy], direction: 0}});
        if (room.walls[i].isLockActionable) {
          setClickableLock(dx, dy, i);
        }
      }
    }
  }

  drawRoomAt(0, 0, room, viewedRoomId);

  function drawInventoryAt(offset: [number, number]) {
    globals.textures.minimap.draw(globals.glyphs, "INVENTORY", offset[0], offset[1], 0);
    const INVENTORY_WIDTH = 5;
    const inventoryGrid: GridCalculator = {
      position: offset,
      offset: [3, 3],
      stride: [6, 5],
    }
    for (const item of player.inventory.items) {
      const onClick = !item.isActionable ? undefined : async () => {
        await autoTurnEnding(true, false);
        try {
          const activateBody = { account, room: viewedRoomId, character: builderOffset, item: item.index };
          const response = await fetch(`/api/match/${match.filename}/activate_inventory_item`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(activateBody),
          });
          if (!response.ok) {
            console.warn(`Failed to activate inventory item, body: ${activateBody}`);
            console.error("Failed to activate inventory item, response:", await response.text());
          } else {
            console.log("Inventory item activated");
            await refreshMatch();
          }
        } catch (error) {
          console.error("Error activating inventory item:", error);
        }
      };

      const itemCell: [number, number] = [item.index % INVENTORY_WIDTH, Math.floor(item.index / INVENTORY_WIDTH)];
      const itemDraw: [number, number] = calculatePosition(inventoryGrid, itemCell);
      if (item.type !== "NIL") {
        globals.painters.items.draw(item.type, {globals, locals: {coords: itemDraw, onClick}});
        console.log(item);
      }
    }
  }

  drawInventoryAt([41, 13]);

  const animationTime = performance.now() - times.serverToClientOffset

  return (
  <div ref={sceneRef} className="scene">
    <pre>{blockToText(globals.glyphs)}</pre>
    <div className="overlay">
      {getAllCharacters(match).map(character =>
        character.keyframes.some((k: Keyframe) => isKeyframeAnimating(k, animationTime))
          ? (
            <AnimatedCharacter
              character={character}
              animationTime={animationTime}
              globals={rebuildGlyphs(globals, 5,4)}
              room={roomProps}
            />
          )
          : null
      )}
    </div>
  </div>
);

}
