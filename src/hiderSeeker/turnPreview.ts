// Computes turn previews from the hider view's rules (how many ticks a move advances before it applies,
// design doc section 3.2) and a readable summary of a move response.
// The hider view's rules object, sent by the backend: AP regeneration per tick, the AP cap,
// the most ticks one move may advance, and the AP cost per intent type.
export interface HsRules {
  ap_regen_per_tick: number;
  ap_cap: number;
  max_advance_ticks: number;
  action_ap_costs: Record<string, number>;
}

/**
 * Calculates how many ticks are needed to afford a given AP cost.
 * 
 * @param actionPoints - Current action points
 * @param apCost - Cost of the action in AP
 * @param rules - The hider view's rules
 * @returns Number of ticks needed, or null if unaffordable within max_advance_ticks
 */
export function ticksToAfford(actionPoints: number, apCost: number, rules: HsRules): number | null {
  // If we already have enough AP, no ticks needed
  if (actionPoints >= apCost) {
    return 0;
  }
  
  // If the cost exceeds the cap, it's impossible to afford
  if (apCost > rules.ap_cap) {
    return null;
  }
  
  // Calculate ticks needed using ceiling division
  const ticksNeeded = Math.ceil((apCost - actionPoints) / rules.ap_regen_per_tick);
  
  // Return null if it would take more than max_advance_ticks
  if (ticksNeeded > rules.max_advance_ticks) {
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
  // Determine cost from the view's rules, defaulting to 0 if not found
  const cost = view.rules.action_ap_costs[intentType] ?? 0;
  
  // Special case for ADD_SERVER - it requires 1 LOA
  let ticks: number | null;
  if (intentType === 'ADD_SERVER' && view.self.loa < 1) {
    ticks = null;
  } else {
    ticks = ticksToAfford(view.self.action_points, cost, view.rules);
  }
  
  // Build summary based on ticks and play mode
  if (ticks === null) {
    return {
      ticks: null,
      summary: `Never affordable within ${view.rules.max_advance_ticks} ticks.`
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