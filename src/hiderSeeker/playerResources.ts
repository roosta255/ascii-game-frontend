import { connectionCounts } from "./statusLine";

export function resourceRows(view: {
  self: { action_points: number; loa: number; server_id: number | null };
  team_connections: number;
  team_connections_total: number;
  rules: { ap_cap: number; ap_regen_per_tick: number };
  team: Array<{ server_id: number | null }>;
  team_reward: number;
  reward_target: number;
}): Array<{ name: string; value: string; limit: string; spentBy: string }> {
  const counts = connectionCounts(view);
  
  // Action points
  const ap = view.self.action_points;
  const apCap = view.rules.ap_cap;
  const apRegen = view.rules.ap_regen_per_tick;
  
  // Connections available, in use, lost, total
  const available = counts.available;
  const inUse = counts.inUse;
  const lost = counts.lost;
  const total = counts.total;
  
  // Team reward
  const teamReward = `${view.team_reward} / ${view.reward_target}`;
  
  return [
    {
      name: "Action points",
      value: ap.toString(),
      limit: `+${apRegen}/tick up to ${apCap}`,
      spentBy: "server actions"
    },
    {
      name: "LOA",
      value: view.self.loa.toString(),
      limit: "personal, starts at 1, never regenerates",
      spentBy: "adding or removing a server"
    },
    {
      name: "Connections available",
      value: available.toString(),
      limit: "shared by team",
      spentBy: "connect takes 1, disconnect gives 1 back"
    },
    {
      name: "Connections in use",
      value: inUse.toString(),
      limit: "number of hiders with a server",
      spentBy: "connecting to a server"
    },
    {
      name: "Connections lost",
      value: lost.toString(),
      limit: "never below 0",
      spentBy: "seeker probe hits a server and kicks everyone on it"
    },
    {
      name: "Connections total",
      value: total.toString(),
      limit: "starting pool (3 per hider)",
      spentBy: "team_connections_total"
    },
    {
      name: "Team reward",
      value: teamReward,
      limit: "completed goals add their reward",
      spentBy: "goal completion"
    }
  ];
}