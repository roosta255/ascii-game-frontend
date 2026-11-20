export function connectionCounts(view: {
  team_connections: number;
  team_connections_total: number;
  self: { server_id: number | null };
  team: Array<{ server_id: number | null }>;
}): { available: number; inUse: number; lost: number; total: number } {
  const available = view.team_connections;
  const inUse = [view.self, ...view.team].filter((hider) => hider.server_id !== null).length;
  const total = view.team_connections_total;
  const lost = Math.max(0, total - available - inUse);
  
  return { available, inUse, lost, total };
}

export function hiderStatusLine(view: {
  phase: string;
  tick: number;
  self: { server_id: number | null; action_points: number; status: string; loa: number };
  rules: { ap_cap: number };
  team_connections: number;
  team_connections_total: number;
}): string {
  const { phase, tick, self, rules, team_connections, team_connections_total } = view;
  
  const ap = self.action_points;
  const cap = rules.ap_cap;
  const loa = self.loa;
  
  const counts = connectionCounts(view);
  const available = counts.available;
  const inUse = counts.inUse;
  
  const status = self.server_id !== null ? `ON S${self.server_id}` : 'OFF';
  
  return `T${tick} ${phase} │ AP ${ap}/${cap} │ CONN ${available} free · ${inUse} in use │ LOA ${loa} │ ${status}`;
}

export function spectatorStatusLine(view: {
  phase: string;
  tick: number;
}): string {
  const { phase, tick } = view;
  
  return `T${tick} ${phase} │ WATCHING`;
}

export function moveBlockedReason(view: {
  phase: string;
  self: { status: string };
}): string | null {
  if (view.phase === "ACTIVE" && view.self.status === "ACTIVE") {
    return null;
  }
  
  if (view.phase === "COMPLETE") {
    return "No moves: the match is over.";
  }
  
  return `No moves: you are ${view.self.status}.`;
}