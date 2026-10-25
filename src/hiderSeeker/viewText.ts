// Text for the hider page, built from one hider view: display names for the
// move API's intent types, the metric column order, and one-line summaries
// of the match, the player, a teammate and a pending move.

// Display name per intent type.
export const ACTION_NAMES: Record<string, string> = {
  CONNECT: "Connect",
  DISCONNECT: "Disconnect",
  ADD_SERVER: "Add server",
  REMOVE_SERVER: "Remove server",
  CONFIGURE_SERVER: "Configure server",
  SUPPRESS_ERROR: "Suppress errors",
  BOOST_CPU: "Boost CPU",
  ROTATE_ROUTE: "Rotate route",
  PAY_GOAL: "Pay goal",
};

// Server metric columns, in the design doc's order.
export const METRIC_ORDER = ["cpu", "memory", "disk", "network", "heat", "errors", "users"];

// The display name of an intent type; an unknown type shows as itself.
export function actionName(type: string): string {
  return ACTION_NAMES[type] ?? type;
}

// "on server 2", or "disconnected" for a null server_id.
export function serverText(serverId: number | null): string {
  return serverId === null ? 'disconnected' : `on server ${serverId}`;
}

// "<match_id>, <phase>, tick <tick>, revision <revision>"
export function matchSummary(view: any): string {
  return `${view.match_id}, ${view.phase}, tick ${view.tick}, revision ${view.revision}`;
}

// "Hider <id>, <status>, <AP> AP, <LOA> LOA, <server>"
export function selfSummary(view: any): string {
  return `Hider ${view.self.hider_id}, ${view.self.status}, ${view.self.action_points} AP, ${view.self.loa} LOA, ${serverText(view.self.server_id)}`;
}

// "Hider <id> (<account or open>), <status>, <server>"
export function teammateSummary(mate: any): string {
  return `Hider ${mate.hider_id} (${mate.account ?? "open"}), ${mate.status}, ${serverText(mate.server_id)}`;
}

// "#<queue_position + 1> <action>[ <server_id>], hider <id>[ (you)], <intent_id>".
// Only REMOVE_SERVER carries a server_id: "Remove server 2".
export function pendingSummary(move: any, selfHiderId: number): string {
  const target = move.server_id === null ? '' : ` ${move.server_id}`;
  const you = move.hider_id === selfHiderId ? ' (you)' : '';
  return `#${move.queue_position + 1} ${actionName(move.action)}${target}, hider ${move.hider_id}${you}, ${move.intent_id}`;
}