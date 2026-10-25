// What the hider page lists from one hider view: the moves the player can
// pick, their own cancellable pending moves, and each goal as text.
//
// Only a move's shape comes from here; the backend decides whether it is legal.
// Nothing here ranks servers or suggests targets (design doc section 3.5).

export interface MoveOption {
  label: string;
  intent: { type: string; server_id?: number };
}

// Hider actions that apply to the server the hider is connected to.
export const SERVER_ACTIONS = ["CONFIGURE_SERVER", "SUPPRESS_ERROR", "BOOST_CPU", "ROTATE_ROUTE", "PAY_GOAL"];

// Connection moves first, then the connected server's actions, then
// ADD_SERVER, then REMOVE_SERVER for each active server.
export function buildMoveOptions(view: any): MoveOption[] {
  const options: MoveOption[] = [];
  
  if (view.self.server_id === null) {
    // When disconnected: connect options for each server
    for (const server of view.servers) {
      options.push({
        label: `Connect to server ${server.server_id}`,
        intent: { type: "CONNECT", server_id: server.server_id }
      });
    }
  } else {
    // When connected: disconnect option first
    const s = view.self.server_id;
    options.push({
      label: `Disconnect from server ${s}`,
      intent: { type: "DISCONNECT" }
    });
    
    // Then server actions in SERVER_ACTIONS order
    for (const type of SERVER_ACTIONS) {
      options.push({
        label: `${type} on server ${s}`,
        intent: { type }
      });
    }
  }
  
  // Add server (1 LOA) option
  options.push({
    label: "Add a server (1 LOA)",
    intent: { type: "ADD_SERVER" }
  });
  
  // Remove server options for each server
  for (const server of view.servers) {
    options.push({
      label: `Remove server ${server.server_id}`,
      intent: { type: "REMOVE_SERVER", server_id: server.server_id }
    });
  }
  
  return options;
}

// The view's pending moves whose hider_id is the viewing hider's.
export function ownPendingMoves(view: any): any[] {
  return view.pending.filter((move: any) => move.hider_id === view.self.hider_id);
}

// "Goal <id> (<status>, reward <amount>): <requirement>; <requirement>"
export function goalText(goal: any): string {
  const requirements = goal.requirements.map((req: any) => {
    if (req.type === "SERVER_METRIC_THRESHOLD") {
      return `server ${req.server_id} ${req.metric} >= ${req.threshold}`;
    } else if (req.type === "ACTIVE_SERVER_COUNT") {
      return `at least ${req.threshold} active servers`;
    } else {
      return `${req.type} ${req.threshold}`;
    }
  }).join("; ");
  
  return `Goal ${goal.goal_id} (${goal.status}, reward ${goal.reward_amount}): ${requirements}`;
}