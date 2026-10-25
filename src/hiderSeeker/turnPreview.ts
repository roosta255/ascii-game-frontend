// Computes turn previews from the public ruleset (how many ticks a move advances before it applies, design
// doc section 3.2) and a readable summary of a move response.
// The constants mirror the backend's placeholder values (pending BALANCE-001):
// HiderAction.enum's AP costs, regeneration.hpp's regen and cap, and state.hpp's MAX_ADVANCE_TICKS,
// so they change together.

export const AP_REGEN_PER_TICK = 2;
export const AP_CAP = 10;
export const MAX_ADVANCE_TICKS = 16;

// AP cost per intent type, in HiderAction.enum order.
export const ACTION_AP_COSTS: Record<string, number> = {
  ADD_SERVER: 0,
  REMOVE_SERVER: 0,
  CONFIGURE_SERVER: 5,
  SUPPRESS_ERROR: 3,
  BOOST_CPU: 2,
  ROTATE_ROUTE: 4,
  PAY_GOAL: 10,
  CONNECT: 0,
  DISCONNECT: 0
};

/**
 * Calculates how many ticks are needed to afford a given AP cost.
 * 
 * @param actionPoints - Current action points
 * @param apCost - Cost of the action in AP
 * @returns Number of ticks needed, or null if unaffordable within MAX_ADVANCE_TICKS
 */
export function ticksToAfford(actionPoints: number, apCost: number): number | null {
  // If we already have enough AP, no ticks needed
  if (actionPoints >= apCost) {
    return 0;
  }
  
  // If the cost exceeds the cap, it's impossible to afford
  if (apCost > AP_CAP) {
    return null;
  }
  
  // Calculate ticks needed using ceiling division
  const ticksNeeded = Math.ceil((apCost - actionPoints) / AP_REGEN_PER_TICK);
  
  // Return null if it would take more than MAX_ADVANCE_TICKS
  if (ticksNeeded > MAX_ADVANCE_TICKS) {
    return null;
  }
  
  return ticksNeeded;
}

/**
 * Formats the number of ticks into a readable string.
 * 
 * @param ticks - Number of ticks
 * @returns Formatted string like "1 tick" or "3 ticks"
 */
export function tickCount(ticks: number): string {
  return `${ticks} tick${ticks === 1 ? '' : 's'}`;
}

/**
 * Interface for move preview objects.
 */
export interface MovePreview {
  // Ticks before the move applies (0: now), or null when it never can.
  ticks: number | null;
  summary: string;
}

/**
 * Calculates how many ticks a move will advance before applying.
 * 
 * @param view - The hider view object
 * @param intentType - Type of intent to preview
 * @param playMode - Whether the move is being played or queued
 * @returns Move preview with ticks and summary
 */
export function previewMove(view: any, intentType: string, playMode: "PLAY" | "QUEUE"): MovePreview {
  // Determine cost from ACTION_AP_COSTS, defaulting to 0 if not found
  const cost = ACTION_AP_COSTS[intentType] ?? 0;
  
  // Special case for ADD_SERVER - it requires 1 LOA
  let ticks: number | null;
  if (intentType === 'ADD_SERVER' && view.self.loa < 1) {
    ticks = null;
  } else {
    ticks = ticksToAfford(view.self.action_points, cost);
  }
  
  // Build summary based on ticks and play mode
  if (ticks === null) {
    return {
      ticks: null,
      summary: `Never affordable within ${MAX_ADVANCE_TICKS} ticks.`
    };
  } else if (ticks === 0) {
    return {
      ticks: 0,
      summary: 'Applies now. No ticks pass.'
    };
  } else {
    const tickString = tickCount(ticks);
    if (playMode === 'PLAY') {
      return {
        ticks,
        summary: `Advances ${tickString}, then applies. The seeker acts each tick.`
      };
    } else { // QUEUE
      return {
        ticks,
        summary: `Queued. Applies after about ${tickString}, once a player advances time.`
      };
    }
  }
}

/**
 * Creates a preview for passing time.
 * 
 * @param ticks - Number of ticks to advance
 * @returns Move preview with ticks and summary
 */
export function previewPass(ticks: number): MovePreview {
  return {
    ticks,
    summary: `Advances ${tickCount(ticks)}. The seeker acts each tick.`
  };
}

/**
 * Describes the result of a move or cancel operation.
 * 
 * @param body - The move/cancel response body
 * @returns Array of human-readable strings describing the result
 */
export function describeMoveResult(body: any): string[] {
  const result: string[] = [];
  
  // First line: status and ticks advanced
  result.push(`${body.status}: ${tickCount(body.ticks_advanced)} advanced, now tick ${body.tick}.`);
  
  // Add reason if needed
  if (body.status === 'REJECTED' || 
      (body.status === 'CANCELLED' && body.rule_outcome !== 'ACCEPTED')) {
    result.push(`Reason: ${body.rule_outcome}.`);
  }
  
  // Add pending applied intents
  if (body.pending_applied && body.pending_applied.length > 0) {
    result.push(`Pending applied: ${body.pending_applied.join(', ')}.`);
  }
  
  // Add pending cancelled intents
  if (body.pending_cancelled_reasons && body.pending_cancelled_reasons.length > 0) {
    for (const cancelled of body.pending_cancelled_reasons) {
      result.push(`Pending cancelled: ${cancelled.intent_id} (${cancelled.reason}).`);
    }
  }
  
  return result;
}