// builds what the hider page lists from one hider view (the moves the player can pick, their own cancellable pending moves, and each goal as text), that only a move's shape comes from here while the backend decides whether it is legal, and that nothing here ranks servers or suggests targets (design doc section 3.5)

export interface MoveOption {
  label: string;
  intent: { type: string; server_id?: number };
}

// Hider actions that apply to the server the hider is connected to.
export const SERVER_ACTIONS = ["CONFIGURE_SERVER", "SUPPRESS_ERROR", "BOOST_CPU", "ROTATE_ROUTE", "PAY_GOAL"];

/**
 * **`buildMoveOptions(view)`**, in this order:
 * 1. While `view.self.server_id` is null: for each server in
 *    `view.servers`, `{ label: `Connect to server ${id}`, intent: { type: "CONNECT", server_id: id } }`.
 *    While connected to server `s`: first
 *    `{ label: `Disconnect from server ${s}`, intent: { type: "DISCONNECT" } }`,
 *    then for each `type` of `SERVER_ACTIONS`, in order,
 *    `{ label: `${type} on server ${s}`, intent: { type } }`.
 * 2. `{ label: "Add a server (1 LOA)", intent: { type: "ADD_SERVER" } }`.
 * 3. For each server in `view.servers`,
 *    `{ label: `Remove server ${id}`, intent: { type: "REMOVE_SERVER", server_id: id } }`.
 */
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

/**
 * **`ownPendingMoves(view)`**: the entries of `view.pending` whose
 * `hider_id` equals `view.self.hider_id`, in order (the same objects, not
 * copies).
 */
export function ownPendingMoves(view: any): any[] {
  return view.pending.filter((move: any) => move.hider_id === view.self.hider_id);
}

/**
 * **`goalText(goal)`**:
 * `` `Goal ${goal_id} (${status}, reward ${reward_amount}): ${requirements}` ``,
 * where `requirements` is each requirement's text joined with `"; "`:
 * - `"SERVER_METRIC_THRESHOLD"`: `` `server ${server_id} ${metric} >= ${threshold}` ``
 * - `"ACTIVE_SERVER_COUNT"`: `` `at least ${threshold} active servers` ``
 * - any other type: `` `${type} ${threshold}` ``
 */
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