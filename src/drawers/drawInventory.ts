import { DrawerProps } from '../types/DrawerProps';
import { calculatePosition, GridCalculator } from '../types/GridCalculator';
import { Keyframe, predictedActionsRemaining, createActionDecrementPrediction } from '../types/Keyframe';
import { getSynth } from '../audio/index';

export interface DrawInventoryProps {
  globals: DrawerProps;
  player: any;
  match: any;
  account: string;
  viewedRoomId: number;
  builderOffset: number;
  BUILDER_ID: number;
  predictedStatsRef: { current: Keyframe[] };
  times: { serverToClientOffset: number; fetchTime: number };
  refreshMatch: () => Promise<void>;
}

export function drawInventoryAt(
  offset: [number, number],
  { globals, player, match, account, viewedRoomId, builderOffset, BUILDER_ID, predictedStatsRef, times, refreshMatch }: DrawInventoryProps,
) {
  if (player.inventory.isEmpty) return;

  globals.textures.minimap.draw(globals.glyphs, "INVENTORY", offset[0], offset[1], 0);

  const INVENTORY_WIDTH = 5;
  const inventoryGrid: GridCalculator = {
    position: offset,
    offset: [3, 3],
    stride: [6, 6],
  };

  for (const item of player.inventory.items) {
    const onClick = !item.isActionable ? undefined : async () => {
      try {
        getSynth().playSquare(220);
        const builderCharacter = match.builders[BUILDER_ID].character;
        const isForcedTurnEnd = predictedActionsRemaining(builderCharacter.actionsRemaining, predictedStatsRef.current, times.fetchTime) === 0;
        predictedStatsRef.current = [...predictedStatsRef.current, createActionDecrementPrediction(builderCharacter.actionsRemaining, predictedStatsRef.current, times)];
        const activateBody = { account, room: viewedRoomId, character: builderOffset, item: item.index, isForcedTurnEnd };
        const response = await fetch(`${API_BASE}/api/match/${match.filename}/activate_inventory_item`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(activateBody),
        });
        if (!response.ok) {
          console.warn(`Failed to activate inventory item, body: ${activateBody}`);
          console.error("Failed to activate inventory item, response:", await response.text());
          predictedStatsRef.current = [];
        } else {
          console.log("Inventory item activated");
          await refreshMatch();
          predictedStatsRef.current = [];
        }
      } catch (error) {
        console.error("Error activating inventory item:", error);
        predictedStatsRef.current = [];
      }
    };

    const itemCell: [number, number] = [item.index % INVENTORY_WIDTH, Math.floor(item.index / INVENTORY_WIDTH)];
    const itemDraw: [number, number] = calculatePosition(inventoryGrid, itemCell);
    if (item.type !== "NIL") {
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
