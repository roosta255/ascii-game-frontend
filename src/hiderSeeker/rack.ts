export const LIGHT_ON = "\u25A0";
export const LIGHT_OFF = "\xB7";
export const MAX_SERVERS = 16;

interface ServerWithLights {
  server_id: number;
  lights: { heat: boolean, errors: boolean, seeker_connected: boolean };
  metrics: any;
  history: any;
}

export function rackSlots(servers: ServerWithLights[]) {
  const slots: Array<{ serverId: number, server: ServerWithLights | null }> = [];
  
  for (let i = 0; i < MAX_SERVERS; i++) {
    const server = servers.find((s) => s.server_id === i) || null;
    slots.push({ serverId: i, server });
  }
  
  return slots;
}

export function lightGlyphs(lights: { heat: boolean, errors: boolean, seeker_connected: boolean }) {
  return {
    heat: lights.heat ? LIGHT_ON : LIGHT_OFF,
    errors: lights.errors ? LIGHT_ON : LIGHT_OFF,
    seeker: lights.seeker_connected ? LIGHT_ON : LIGHT_OFF
  };
}

export function lightsLine(lights: { heat: boolean, errors: boolean, seeker_connected: boolean }) {
  const glyphs = lightGlyphs(lights);
  return `HEAT ${glyphs.heat} ERR ${glyphs.errors} SEEK ${glyphs.seeker}`;
}

export function occupancy(view: any, serverId: number) {
  if (view.self.server_id === serverId) {
    return "YOU";
  }
  
  const teammates = view.team.filter((t: any) => t.server_id === serverId);
  if (teammates.length > 0) {
    return `+${teammates.length}`;
  }
  
  return "";
}

export function goalsNeedingServer(view: any, serverId: number) {
  return view.goals
    .filter((goal: any) => goal.status === "OPEN" && goal.requirements.some((req: any) => req.server_id === serverId))
    .map((goal: any) => goal.goal_id);
}

export function relocationTarget(view: any, serverId: number) {
  const otherServers = view.servers.filter((s: any) => s.server_id !== serverId);
  
  if (otherServers.length === 0) {
    return null;
  }
  
  return Math.min(...otherServers.map((s: any) => s.server_id));
}

export function serverAccess(view: any, serverId: number) {
  if (view.self.server_id === serverId) {
    return "HERE";
  }
  
  if (view.self.server_id !== null && view.self.server_id !== serverId) {
    return "ELSEWHERE";
  }
  
  return "DISCONNECTED";
}