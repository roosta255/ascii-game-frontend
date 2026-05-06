import { DrawerProps } from '../types/DrawerProps';
import { RoomProps, toFloorGlyphsFromCell, toFloorGlyphsFromDoor, toFloorGlyphsFromLock } from '../types/RoomProps';
import {
  Keyframe, isKeyframeAnimating,
  createMovePrediction, predictedMovesRemaining, predictedActionsRemaining,
  createMoveDecrementPrediction, createActionDecrementPrediction,
} from '../types/Keyframe';
import { markRegionClickable, debugKeyframes } from './canvasUtils';
import { getSynth } from '../audio/index';

export interface DrawRoomContext {
  globals: DrawerProps;
  roomProps: RoomProps;
  offsetMap: Record<string | number, any>;
  match: any;
  account: string;
  builderOffset: number;
  BUILDER_ID: number;
  isMatchStarted: boolean;
  times: { serverToClientOffset: number; fetchTime: number };
  predictedStatsRef: { current: Keyframe[] };
  predictedMovesRef: { current: Keyframe[] };
  predictedLocationRef: { current: { type: string; data: number; t1: number } | null };
  setPredictedMoves: (moves: Keyframe[]) => void;
  refreshMatch: () => Promise<void>;
  setRoomTransition: (t: { toRoom: number; direction: number; endTime: number } | null) => void;
  onChestClick: (chestId: number) => void;
  chestOffsetMap: Record<number, number>;
}

export function drawRoomAt(roomX: number, roomY: number, room: any, roomId: number, ctx: DrawRoomContext) {
  const {
    globals, roomProps, offsetMap, match, account, builderOffset, BUILDER_ID,
    isMatchStarted, times, predictedStatsRef, predictedMovesRef, predictedLocationRef,
    setPredictedMoves, refreshMatch, setRoomTransition, onChestClick, chestOffsetMap,
  } = ctx;

  const glyphs = globals.glyphs;

  // TODO: remove global mutation
  roomProps.position = [roomX, roomY];

  function drawCharacterAt(drawX: number, drawY: number, cell: any) {
    const character = cell.offset && offsetMap[cell.offset];
    if (!character) return;
    if (character.keyframes.find((k: Keyframe) => isKeyframeAnimating(k, performance.now() - times.serverToClientOffset)) !== undefined) return;
    const chestIndex = chestOffsetMap[character.offset];
    if (chestIndex != null) {
      globals.painters.roles.draw(character.role, { globals, locals: { coords: [drawX, drawY], onClick: () => onChestClick(chestIndex) } });
      return;
    }
    const onClick = (!character.isActionable || !isMatchStarted) ? undefined : async () => {
      try {
        const builderCharacter = match.builders[BUILDER_ID].character;
        const isForcedTurnEnd = predictedActionsRemaining(builderCharacter.actionsRemaining, predictedStatsRef.current, times.fetchTime) === 0;
        predictedStatsRef.current = [...predictedStatsRef.current, createActionDecrementPrediction(builderCharacter.actionsRemaining, predictedStatsRef.current, times)];
        debugKeyframes(`character click → predicted stats`, predictedStatsRef.current);
        debugKeyframes(`character click → builder keyframes (server)`, builderCharacter.keyframes ?? []);
        getSynth().playSquare(220);
        const target = character.isObject ? builderOffset : cell.offset;
        const activator = character.isObject ? cell.offset : builderOffset;
        const activateBody = { account, room: roomId, character: activator, target, isForcedTurnEnd };
        const stringifiedBody = JSON.stringify(activateBody);
        const response = await fetch(`${API_BASE}/api/match/${match.filename}/activate_character`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: stringifiedBody,
        });
        if (!response.ok) {
          console.warn(`Failed to activate character, body: ${stringifiedBody}`);
          console.error("Failed to activate character, response:", await response.text());
          predictedStatsRef.current = [];
        } else {
          console.log("Character activated");
          await refreshMatch();
          predictedStatsRef.current = [];
        }
      } catch (error) {
        console.error("Error activating character:", error);
        predictedStatsRef.current = [];
      }
    };
    globals.painters.roles.draw(character.role, { globals, locals: { coords: [drawX, drawY], onClick } });
  }

  globals.painters.backgrounds.draw(room.type, { globals, locals: { coords: [roomX, roomY], room } });
  globals.painters.doorways.draw(room.type, { globals, locals: { coords: [roomX, roomY], room } });

  const CELL_SIZE_X = 5;
  const CELL_SIZE_Y = 4;

  function setClickableFloor(drawX: number, drawY: number, floor: number) {
    if (!isMatchStarted) return;
    markRegionClickable(glyphs, drawX, drawY, CELL_SIZE_X, CELL_SIZE_Y, async () => {
      try {
        const builderCharacter = match.builders[BUILDER_ID].character;
        const currentAnimTime = performance.now() - times.serverToClientOffset;
        const predictedLoc = predictedLocationRef.current;
        const activePredictedLoc = (predictedLoc && predictedLoc.t1 > currentAnimTime) ? predictedLoc : null;
        if (predictedLoc && !activePredictedLoc) {
          predictedMovesRef.current = [];
          predictedLocationRef.current = null;
        }
        const sourceCharacter = activePredictedLoc
          ? { ...builderCharacter, location: { type: activePredictedLoc.type, data: activePredictedLoc.data } }
          : builderCharacter;
        const movePrediction = createMovePrediction(roomId, floor, undefined, sourceCharacter, match, times, activePredictedLoc?.t1);
        const isForcedTurnEnd = predictedMovesRemaining(builderCharacter.movesRemaining, predictedStatsRef.current, times.fetchTime) === 0;
        if (movePrediction.length > 0) {
          predictedStatsRef.current = [...predictedStatsRef.current, createMoveDecrementPrediction(builderCharacter.movesRemaining, predictedStatsRef.current, times)];
          predictedLocationRef.current = { type: 'FLOOR', data: floor, t1: movePrediction[0].t1 };
        }
        const chainedPredictions = activePredictedLoc
          ? [...predictedMovesRef.current.filter(k => !k.animation.startsWith('STANDING_')), ...movePrediction]
          : movePrediction;
        predictedMovesRef.current = chainedPredictions;
        debugKeyframes(`floor click → predicted movement`, chainedPredictions);
        debugKeyframes(`floor click → builder keyframes (server)`, builderCharacter.keyframes ?? []);
        setPredictedMoves(chainedPredictions);
        const moveBody = { account, character: builderOffset, room: roomId, floor, isForcedTurnEnd };
        getSynth().playSquare(220);
        const stringifyMoveBody = JSON.stringify(moveBody);
        const res = await fetch(
          `${API_BASE}/api/match/${match.filename}/move_character`,
          { method: "POST", headers: { "Content-Type": "application/json" }, body: stringifyMoveBody },
        );
        console.log("Move request (non-JSON):", stringifyMoveBody);
        const bodyText = await res.text();
        if (!res.ok) {
          console.info(`❌ HTTP ${res.status} request:`, moveBody);
          console.error(`❌ HTTP ${res.status} response:`, bodyText);
          setPredictedMoves([]);
          predictedMovesRef.current = [];
          predictedLocationRef.current = null;
          throw new Error(`HTTP ${res.status}`);
        }
        if (bodyText.trim().startsWith("{") || bodyText.trim().startsWith("[")) {
          console.log("✅ Move success:", JSON.parse(bodyText));
        } else {
          console.log("✅ Move success response (non-JSON):", bodyText);
        }
        await refreshMatch();
        predictedStatsRef.current = [];
      } catch (err) {
        console.error("❌ Floor move failed:", err);
        setPredictedMoves([]);
        predictedMovesRef.current = [];
        predictedLocationRef.current = null;
        predictedStatsRef.current = [];
      }
    });
  }

  var i = 0;
  for (const cell of room.floorCells) {
    const [drawX, drawY] = toFloorGlyphsFromCell(roomProps, i);
    const character = cell.offset && offsetMap[cell.offset];
    if (!character) {
      setClickableFloor(drawX, drawY, i);
    } else {
      drawCharacterAt(drawX, drawY, cell);
    }
    i++;
  }

  function setClickableDoorway(drawX: number, drawY: number, direction: number, route: string, nextViewedRoomId?: number) {
    if (!isMatchStarted) return;
    markRegionClickable(glyphs, drawX, drawY, CELL_SIZE_X, CELL_SIZE_Y, async () => {
      const builderCharacter = match.builders[BUILDER_ID].character;
      const currentAnimTime = performance.now() - times.serverToClientOffset;
      const predictedLoc = predictedLocationRef.current;
      const activePredictedLoc = (predictedLoc && predictedLoc.t1 > currentAnimTime) ? predictedLoc : null;
      if (predictedLoc && !activePredictedLoc) {
        predictedMovesRef.current = [];
        predictedLocationRef.current = null;
      }
      const sourceCharacter = activePredictedLoc
        ? { ...builderCharacter, location: { type: activePredictedLoc.type, data: activePredictedLoc.data } }
        : builderCharacter;
      const movePrediction = createMovePrediction(roomId, undefined, direction, sourceCharacter, match, times, activePredictedLoc?.t1);
      const isForcedTurnEnd = predictedMovesRemaining(builderCharacter.movesRemaining, predictedStatsRef.current, times.fetchTime) === 0;
      if (movePrediction.length > 0) {
        predictedStatsRef.current = [...predictedStatsRef.current, createMoveDecrementPrediction(builderCharacter.movesRemaining, predictedStatsRef.current, times)];
        predictedLocationRef.current = { type: 'DOOR', data: direction, t1: movePrediction[0].t1 };
      }
      const chainedPredictions = activePredictedLoc
        ? [...predictedMovesRef.current.filter(k => !k.animation.startsWith('STANDING_')), ...movePrediction]
        : movePrediction;
      predictedMovesRef.current = chainedPredictions;
      debugKeyframes(`door click → predicted movement`, chainedPredictions);
      debugKeyframes(`door click → builder keyframes (server)`, builderCharacter.keyframes ?? []);
      setPredictedMoves(chainedPredictions);
      getSynth().playSquare(220);
      const moveBody = { account, character: builderOffset, room: roomId, direction, isForcedTurnEnd };
      fetch(`${API_BASE}/api/match/${match.filename}/${route}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(moveBody),
      })
        .then(async res => {
          const bodyText = await res.text();
          if (!res.ok) {
            console.info(`❌ HTTP ${res.status} request: `, moveBody);
            console.error(`❌ HTTP ${res.status} response: `, bodyText);
            setPredictedMoves([]);
            predictedMovesRef.current = [];
            predictedLocationRef.current = null;
            throw new Error(`HTTP ${res.status}`);
          }
          try {
            console.log("✅ Move success:", JSON.parse(bodyText));
          } catch {
            console.warn("⚠️ Non-JSON response:", bodyText);
          }
          await refreshMatch();
          predictedStatsRef.current = [];
          if (nextViewedRoomId !== undefined) {
            setRoomTransition({ toRoom: nextViewedRoomId, direction, endTime: performance.now() + 1200 });
          }
        })
        .catch(err => {
          console.error("❌ Move failed:", err);
          setPredictedMoves([]);
          predictedMovesRef.current = [];
          predictedLocationRef.current = null;
          predictedStatsRef.current = [];
        });
    });
  }

  function setClickableLock(drawX: number, drawY: number, direction: number) {
    if (!isMatchStarted) return;
    markRegionClickable(glyphs, drawX, drawY, CELL_SIZE_X, CELL_SIZE_Y, async () => {
      const builderCharacter = match.builders[BUILDER_ID].character;
      const isForcedTurnEnd = predictedActionsRemaining(builderCharacter.actionsRemaining, predictedStatsRef.current, times.fetchTime) === 0;
      predictedStatsRef.current = [...predictedStatsRef.current, createActionDecrementPrediction(builderCharacter.actionsRemaining, predictedStatsRef.current, times)];
      const moveBody = { account, character: builderOffset, room: roomId, direction, isForcedTurnEnd };
      const stringifiedBody = JSON.stringify(moveBody);
      getSynth().playSquare(220);
      fetch(`${API_BASE}/api/match/${match.filename}/activate_lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: stringifiedBody,
      })
        .then(async res => {
          const bodyText = await res.text();
          console.log("Lock request:", stringifiedBody);
          if (!res.ok) {
            console.info(`❌ HTTP ${res.status} request: `, moveBody);
            console.error(`❌ HTTP ${res.status} response: `, bodyText);
            throw new Error(`HTTP ${res.status}`);
          }
          try {
            console.log("✅ Lock success response:", JSON.parse(bodyText));
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
      const [dx, dy] = toFloorGlyphsFromDoor(roomProps, i);
      const cell = room.walls[i].cell;
      globals.painters.doors.draw(room.walls[i].door, { globals, locals: { coords: [dx, dy], direction: 0 } });
      if (room.walls[i].isDoorActionable) {
        let nextViewedRoomId: number | undefined;
        switch (room.walls[i].door) {
          case "LADDER_1_BOTTOM":
          case "POLE_1_BOTTOM":
            nextViewedRoomId = room.above; break;
          case "LADDER_1_TOP":
          case "POLE_1_TOP":
            nextViewedRoomId = room.below; break;
          case "TIME_GATE_AWAKENED":
            switch (room.type) {
              case "TIME_GATE_TO_FUTURE": nextViewedRoomId = room.posterior; break;
              case "TIME_GATE_TO_PAST":   nextViewedRoomId = room.anterior;  break;
            }
            break;
          default:
            nextViewedRoomId = undefined;
        }
        setClickableDoorway(dx, dy, i, "activate_door", nextViewedRoomId);
      } else if (!room.walls[i].isBlocking) {
        setClickableDoorway(dx, dy, i, "move_character", room.walls[i].adjacent);
      }
      drawCharacterAt(dx, dy, cell);
    }
    {
      const [dx, dy] = toFloorGlyphsFromLock(roomProps, i);
      globals.painters.locks.draw(room.walls[i].door, { globals, locals: { coords: [dx, dy], direction: 0 } });
      if (room.walls[i].isLockActionable) {
        setClickableLock(dx, dy, i);
      }
    }
  }
}
