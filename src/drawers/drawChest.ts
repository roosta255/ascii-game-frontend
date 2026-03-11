import { DrawerProps } from '../types/DrawerProps';
import { calculatePosition, GridCalculator } from '../types/GridCalculator';
import { Keyframe, predictedActionsRemaining, createActionDecrementPrediction } from '../types/Keyframe';
import { markRegionClickable } from './canvasUtils';
import { getSynth } from '../audio/index';

export interface DrawChestProps {
  globals: DrawerProps;
  chest: any;
  account: string;
  match: any;
  viewedRoomId: number;
  builderOffset: number;
  BUILDER_ID: number;
  predictedStatsRef: { current: Keyframe[] };
  times: { serverToClientOffset: number };
  refreshMatch: () => Promise<void>;
}

const CHEST_ITEMS_WIDE = 3;
const CHEST_LOCK_OFFSET: [number, number] = [15, 7];
const CELL_SIZE_X = 5;
const CELL_SIZE_Y = 4;

export function drawChestAt(
  offset: [number, number],
  { globals, chest, account, match, viewedRoomId, builderOffset, BUILDER_ID, predictedStatsRef, times, refreshMatch }: DrawChestProps,
) {
  const spriteName = chest.isLocked ? 'CHEST_6_LOCKED' : 'CHEST_6_UNLOCKED';
  globals.textures.minimap.draw(globals.glyphs, spriteName, offset[0], offset[1], 0);

  const containerCharacterId = chest.containerCharacterId;

  if (chest.isLocked) {
    const lockDrawX = offset[0] + CHEST_LOCK_OFFSET[0];
    const lockDrawY = offset[1] + CHEST_LOCK_OFFSET[1];
    globals.painters.chestLocks.draw(chest.lock, { globals, locals: { coords: [lockDrawX, lockDrawY], direction: 0 } });
    markRegionClickable(globals.glyphs, lockDrawX, lockDrawY, CELL_SIZE_X, CELL_SIZE_Y, async () => {
      try {
        getSynth().playSquare(220);
        const builderCharacter = match.builders[BUILDER_ID].character;
        const isForcedTurnEnd = predictedActionsRemaining(builderCharacter.actionsRemaining, predictedStatsRef.current) === 0;
        predictedStatsRef.current = [...predictedStatsRef.current, createActionDecrementPrediction(builderCharacter.actionsRemaining, predictedStatsRef.current, times)];
        const body = { action: 'USE_CHEST_LOCK', account, room: viewedRoomId, character: builderOffset, target: containerCharacterId, isForcedTurnEnd };
        const response = await fetch(`${API_BASE}/api/match/${match.filename}/perform_character_action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          console.error('Failed to use chest lock:', await response.text());
          predictedStatsRef.current = [];
        } else {
          console.log('✅ Chest lock activated');
          await refreshMatch();
          predictedStatsRef.current = [];
        }
      } catch (error) {
        console.error('Error using chest lock:', error);
        predictedStatsRef.current = [];
      }
    });
  } else {
    const itemGrid: GridCalculator = {
      position: offset,
      offset: [3, 3],
      stride: [6, 6],
    };

    for (const item of (chest.inventory?.items ?? [])) {
      if (item.type === 'NIL') continue;
      const itemCell: [number, number] = [item.index % CHEST_ITEMS_WIDE, Math.floor(item.index / CHEST_ITEMS_WIDE)];
      const itemDraw: [number, number] = calculatePosition(itemGrid, itemCell);
      const capturedIndex = item.index;
      const onClick = async () => {
        try {
          getSynth().playSquare(220);
          const builderCharacter = match.builders[BUILDER_ID].character;
          const isForcedTurnEnd = predictedActionsRemaining(builderCharacter.actionsRemaining, predictedStatsRef.current) === 0;
          predictedStatsRef.current = [...predictedStatsRef.current, createActionDecrementPrediction(builderCharacter.actionsRemaining, predictedStatsRef.current, times)];
          const body = { action: 'LOOT_CHEST', account, room: viewedRoomId, character: builderOffset, target: containerCharacterId, item: capturedIndex, isForcedTurnEnd };
          const response = await fetch(`${API_BASE}/api/match/${match.filename}/perform_character_action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!response.ok) {
            console.error('Failed to loot chest:', await response.text());
            predictedStatsRef.current = [];
          } else {
            console.log('✅ Chest item looted');
            await refreshMatch();
            predictedStatsRef.current = [];
          }
        } catch (error) {
          console.error('Error looting chest:', error);
          predictedStatsRef.current = [];
        }
      };
      globals.painters.items.draw(item.type, { globals, locals: { coords: itemDraw, onClick } });
      if (item.stacks > 1) {
        const sx = itemDraw[0] + 3;
        const sy = itemDraw[1] + 5;
        if (globals.glyphs[sy]?.[sx]) {
          globals.glyphs[sy][sx] = { char: String(item.stacks), fg: 0xffffff, bg: 0x000000 };
        }
      }
    }
  }
}
