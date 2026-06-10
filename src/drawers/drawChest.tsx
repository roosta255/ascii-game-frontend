import { DrawerProps, rebuildGlyphs } from '../types/DrawerProps';
import { AnimatedCharacter } from '../types/AnimatedCharacter';
import { AnimationFlyweight } from '../assets/Painter';
import { RoomProps } from '../types/RoomProps';
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
  times: { serverToClientOffset: number; fetchTime: number };
  refreshMatch: () => Promise<void>;
  animationFlyweights: Record<string, AnimationFlyweight>;
  animationTime: number;
  roomProps: RoomProps;
  isLocallyAnimating: (k: Keyframe) => boolean;
  entityLocalAnimTime: (keyframes: Keyframe[]) => number | undefined;
  isMatchStarted: boolean;
  activateItemAsTool?: (extraParams: Record<string, unknown>) => Promise<void>;
  isSelectingToolTarget?: boolean;
}

const CHEST_ITEMS_WIDE = 3;
const CHEST_LOCK_OFFSET: [number, number] = [15, 4];
const CELL_SIZE_X = 5;
const CELL_SIZE_Y = 4;

export function drawChestAt(
  offset: [number, number],
  { globals, chest, account, match, viewedRoomId, builderOffset, BUILDER_ID, predictedStatsRef, times, refreshMatch, animationFlyweights, animationTime, roomProps, isLocallyAnimating, entityLocalAnimTime, isMatchStarted, activateItemAsTool, isSelectingToolTarget }: DrawChestProps,
) {
  const spriteName = chest.isLocked ? 'CHEST_6_LOCKED' : 'CHEST_6_UNLOCKED';
  globals.textures.minimap.draw(globals.glyphs, spriteName, offset[0], offset[1], 0);

  const containerCharacterId = chest.containerCharacterId;

  const lockDrawX = offset[0] + CHEST_LOCK_OFFSET[0];
  const lockDrawY = offset[1] + CHEST_LOCK_OFFSET[1];
  if (chest.lock?.keyframes?.some((k: Keyframe) => isLocallyAnimating(k))) {
    globals.animatedExtras.push(
      <AnimatedCharacter
        key={`chest-lock-${containerCharacterId}`}
        keyframes={chest.lock.keyframes}
        painter={globals.painters.chestLocks!}
        name={chest.lock.type}
        animationFlyweights={animationFlyweights}
        animationTime={animationTime}
        localAnimationTime={entityLocalAnimTime(chest.lock.keyframes)}
        position={[lockDrawX, lockDrawY]}
        globals={rebuildGlyphs(globals, CELL_SIZE_X, CELL_SIZE_Y)}
        room={roomProps}
      />
    );
  } else {
    globals.painters.chestLocks.draw(chest.lock, { globals, locals: { coords: [lockDrawX, lockDrawY], direction: 0 } });
  }
  if (chest.isLockActionable)
  {
    markRegionClickable(globals.glyphs, lockDrawX, lockDrawY, CELL_SIZE_X, CELL_SIZE_Y, async () => {
      try {
        getSynth().playSquare(220);
        const builderCharacter = match.builders[BUILDER_ID].character;
        const isForcedTurnEnd = predictedActionsRemaining(builderCharacter.actionsRemaining, predictedStatsRef.current, times.fetchTime) === 0;
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
          console.log('✅ Chest lock used');
          await refreshMatch();
          predictedStatsRef.current = [];
        }
      } catch (error) {
        console.error('Error using chest lock:', error);
        predictedStatsRef.current = [];
      }
    });
  }
  

  if (!chest.isLocked) {
    const itemGrid: GridCalculator = {
      position: offset,
      offset: [9, 9],
      stride: [6, 6],
    };

    for (const item of (chest.inventory?.items ?? [])) {
      if (item.type === 'NIL') continue;
      const itemCell: [number, number] = [item.index % CHEST_ITEMS_WIDE, Math.floor(item.index / CHEST_ITEMS_WIDE)];
      const itemDraw: [number, number] = calculatePosition(itemGrid, itemCell);
      const capturedIndex = item.index;
      const onClick = async () => {
        if (isSelectingToolTarget && activateItemAsTool) {
          await activateItemAsTool({ target_item: capturedIndex, target_inventory: chest.inventory?.inventoryId });
          return;
        }
        try {
          getSynth().playSquare(220);
          const builderCharacter = match.builders[BUILDER_ID].character;
          const isForcedTurnEnd = predictedActionsRemaining(builderCharacter.actionsRemaining, predictedStatsRef.current, times.fetchTime) === 0;
          predictedStatsRef.current = [...predictedStatsRef.current, createActionDecrementPrediction(builderCharacter.actionsRemaining, predictedStatsRef.current, times)];
          const body = { action: 'LOOT_CHEST', account, room: viewedRoomId, character: builderOffset, target: containerCharacterId, target_item: capturedIndex, target_inventory: chest.inventory?.inventoryId, isForcedTurnEnd };
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
      if (item.type === 'CRITTER') {
        const critterId = item.stacks;
        const allChars = [...(match.dungeon?.characters ?? []), ...(match.builders?.map((b: any) => b.character) ?? [])];
        const critter = allChars.find((c: any) => c.characterId === critterId);
        if (critter) {
          const onCritterClick = async () => {
            try {
              getSynth().playSquare(220);
              const builderCharacter = match.builders[BUILDER_ID].character;
              const isForcedTurnEnd = predictedActionsRemaining(builderCharacter.actionsRemaining, predictedStatsRef.current, times.fetchTime) === 0;
              predictedStatsRef.current = [...predictedStatsRef.current, createActionDecrementPrediction(builderCharacter.actionsRemaining, predictedStatsRef.current, times)];
              const body = { action: 'CRITTER_BITE', account, room: viewedRoomId, character: critterId, target: builderOffset, isForcedTurnEnd };
              const response = await fetch(`${API_BASE}/api/match/${match.filename}/perform_character_action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
              if (!response.ok) {
                console.error('Failed to perform CRITTER_BITE:', await response.text());
                predictedStatsRef.current = [];
              } else {
                console.log('✅ CRITTER_BITE performed');
                await refreshMatch();
                predictedStatsRef.current = [];
              }
            } catch (error) {
              console.error('Error performing CRITTER_BITE:', error);
              predictedStatsRef.current = [];
            }
          };
          globals.painters.roles.draw(critter.role, { globals, locals: { coords: itemDraw, onClick: onCritterClick } });
        }
      } else if (item.type === 'CONTAINED') {
        const containedId = item.stacks;
        const allChars = [...(match.dungeon?.characters ?? []), ...(match.builders?.map((b: any) => b.character) ?? [])];
        const contained = allChars.find((c: any) => c.characterId === containedId);
        if (contained) {
          const onContainedClick = (!contained.isActionable || !isMatchStarted) ? undefined : async () => {
            try {
              getSynth().playSquare(220);
              const builderCharacter = match.builders[BUILDER_ID].character;
              const isForcedTurnEnd = predictedActionsRemaining(builderCharacter.actionsRemaining, predictedStatsRef.current, times.fetchTime) === 0;
              predictedStatsRef.current = [...predictedStatsRef.current, createActionDecrementPrediction(builderCharacter.actionsRemaining, predictedStatsRef.current, times)];
              const target = contained.isObject ? builderOffset : containedId;
              const activator = contained.isObject ? containedId : builderOffset;
              const body = { account, room: viewedRoomId, character: activator, target, isForcedTurnEnd };
              const response = await fetch(`${API_BASE}/api/match/${match.filename}/activate_character`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });
              if (!response.ok) {
                console.error('Failed to activate contained character:', await response.text());
                predictedStatsRef.current = [];
              } else {
                console.log('✅ Contained character activated');
                await refreshMatch();
                predictedStatsRef.current = [];
              }
            } catch (error) {
              console.error('Error activating contained character:', error);
              predictedStatsRef.current = [];
            }
          };
          globals.painters.roles.draw(contained.role, { globals, locals: { coords: itemDraw, onClick: onContainedClick } });
        }
      } else {
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
}
