// Server action types and utilities for displaying them in the UI.

import { METRIC_ORDER } from "./viewText";

// The list of server actions in the order they should be displayed.
export const SERVER_ACTION_ROWS = [
  "CONFIGURE_SERVER",
  "SUPPRESS_ERROR", 
  "BOOST_CPU",
  "ROTATE_ROUTE",
  "PAY_GOAL",
  "DISCONNECT"
];

/**
 * Returns the AP cost for a given action type.
 * @param view - The hider view
 * @param type - The action type
 * @returns The AP cost, or 0 if not found
 */
export function apCost(view: any, type: string): number {
  return view.rules.action_ap_costs[type] ?? 0;
}

/**
 * Returns the visible effect text for a given action type.
 * @param view - The hider view
 * @param type - The action type
 * @returns The effect description text
 */
export function effectText(view: any, type: string): string {
  // Special handling for specific action types
  if (type === "PAY_GOAL") {
    if (view.completable_goal_id !== null) {
      return `Completes goal ${view.completable_goal_id}`;
    } else {
      return "No goal is ready: the AP is spent for nothing";
    }
  }
  
  if (type === "DISCONNECT") {
    return "Returns 1 connection to the team";
  }
  
  // For other action types, read from rules.action_effects
  const effects = view.rules.action_effects[type];
  
  // If no effects or empty effects, return "No visible effect"
  if (!effects || Object.keys(effects).length === 0) {
    return "No visible effect";
  }
  
  // Build the effect text in METRIC_ORDER
  const parts: string[] = [];
  for (const metric of METRIC_ORDER) {
    if (effects.hasOwnProperty(metric)) {
      const value = effects[metric];
      const sign = value >= 0 ? "+" : "\u2212"; // U+2212 minus sign
      parts.push(`${metric} ${sign}${Math.abs(value)}`);
    }
  }
  
  // If no metrics were found, return "No visible effect"
  if (parts.length === 0) {
    return "No visible effect";
  }
  
  return parts.join(", ");
}