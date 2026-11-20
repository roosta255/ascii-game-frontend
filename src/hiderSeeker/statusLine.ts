export function connectionCounts(view: any) {
  const available = view.team_connections;
  // Count all team members with server_id !== null plus the self player
  const inUse = view.team.reduce((count: number, hider: any) => {
    return count + (hider.server_id !== null ? 1 : 0);
  }, view.self.server_id !== null ? 1 : 0);
  const total = view.team_connections_total;
  const lost = Math.max(0, total - available - inUse);
  
  return { available, inUse, lost, total };
}

export function hiderStatusLine(view: any) {
  const { available, inUse } = connectionCounts(view);
  const ap = view.self.action_points;
  const cap = view.rules.ap_cap;
  const loa = view.self.loa;
  const serverId = view.self.server_id;
  
  let final = 'OFF';
  if (serverId !== null) {
    const server = view.servers.find((s: any) => s.server_id === serverId);
    if (server && server.lights.seeker_connected) {
      final = `ON S${serverId}`;
    }
  }
  
  return `T${view.tick} ${view.phase} │ AP ${ap}/${cap} │ CONN ${available} free · ${inUse} in use │ LOA ${loa} │ ${final}`;
}

export function spectatorStatusLine(publicView: any) {
  return `T${publicView.tick} ${publicView.phase} │ WATCHING`;
}

export function moveBlockedReason(view: any) {
  if (view.phase === "ACTIVE" && view.self.status === "ACTIVE") {
    return null;
  }
  
  if (view.phase === "COMPLETE") {
    return "No moves: the match is over.";
  }
  
  return `No moves: you are ${view.self.status}.`;
}