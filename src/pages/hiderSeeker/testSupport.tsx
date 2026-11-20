// Answers each request with the body registered for the first matching URL fragment.
export function stubFetch(bodies: Record<string, unknown>) {
  const fetchFn = vi.fn(async (url: string) => {
    const key = Object.keys(bodies).find((fragment) => url.includes(fragment));
    return new Response(key ? JSON.stringify(bodies[key]) : '{}', { status: key ? 200 : 404 });
  });
  vi.stubGlobal('fetch', fetchFn);
  return fetchFn;
}

export const MATCH = { match_id: 'm1', phase: 'ACTIVE', revision: 11, host: 'alice',
  hiders: [{ hider_id: 0, account: 'alice' }, { hider_id: 1, account: 'bob' }, { hider_id: 2, account: 'carol' }] };
const frame = (cpu: number) => ({ cpu, memory: 1, disk: 2, network: 3, heat: 4, errors: 5, users: 6 });
const off = { heat: false, errors: false, seeker_connected: false };
export const HIDER_VIEW = {
  match_id: 'm1', audience: 'hider', view_version: 6, phase: 'ACTIVE', tick: 17, revision: 11, winner: null,
  hider_id: 0, hider_count: 3, server_count: 3,
  self: { hider_id: 0, account: 'alice', status: 'ACTIVE', action_points: 6, server_id: 1, loa: 1, resources: [1, 0, 0, 0, 0, 0, 0, 0] },
  team: [
    { hider_id: 1, account: 'bob', status: 'ACTIVE', server_id: 0 },
    { hider_id: 2, account: 'carol', status: 'CAPTURED', server_id: null },
  ],
  servers: [
    { server_id: 0, lights: { heat: true, errors: false, seeker_connected: false }, metrics: null, history: null },
    { server_id: 1, lights: { heat: false, errors: true, seeker_connected: true }, metrics: frame(25),
      history: Array.from({ length: 16 }, (_, i) => frame(i)) },
    { server_id: 3, lights: off, metrics: null, history: null },
  ],
  pending: [
    { intent_id: 'mv-1', hider_id: 1, account: 'bob', action: 'BOOST_CPU', server_id: null, queue_position: 0 },
    { intent_id: 'mv-2', hider_id: 0, account: 'alice', action: 'REMOVE_SERVER', server_id: 3, queue_position: 1 },
  ],
  team_connections: 4, team_connections_total: 9,
  goals: [
    { goal_id: 0, status: 'OPEN', reward_amount: 1, requirements: [{ type: 'SERVER_METRIC_THRESHOLD', server_id: 0, metric: 'CPU', threshold: 40 }] },
    { goal_id: 1, status: 'OPEN', reward_amount: 1, requirements: [{ type: 'SERVER_METRIC_THRESHOLD', server_id: 1, metric: 'NETWORK', threshold: 3 }] },
    { goal_id: 2, status: 'COMPLETED', reward_amount: 1, requirements: [{ type: 'ACTIVE_SERVER_COUNT', server_id: null, metric: null, threshold: 3 }] },
  ],
  completable_goal_id: 1, team_reward: 1, reward_target: 3,
  rules: {
    ap_regen_per_tick: 2, ap_cap: 10, max_advance_ticks: 16,
    action_ap_costs: { ADD_SERVER: 0, REMOVE_SERVER: 0, CONFIGURE_SERVER: 5, SUPPRESS_ERROR: 3, BOOST_CPU: 2,
                       ROTATE_ROUTE: 4, PAY_GOAL: 10, CONNECT: 0, DISCONNECT: 0 },
    action_effects: { ADD_SERVER: {}, REMOVE_SERVER: {}, CONFIGURE_SERVER: {}, SUPPRESS_ERROR: { errors: -10 },
                      BOOST_CPU: { cpu: 15 }, ROTATE_ROUTE: { network: 5 }, PAY_GOAL: {}, CONNECT: {}, DISCONNECT: {} },
  },
  events: [
    { type: 'SERVER_ADDED', tick: 0, revision: 3 },
    { type: 'SERVER_PROBED', tick: 11, revision: 10, server_id: 0, outcome: 'MISS' },
  ],
};
export const PUBLIC_VIEW = {
  match_id: 'm1', audience: 'public', view_version: 6, phase: 'ACTIVE', tick: 17, revision: 11, winner: null,
  hiders: [{ hider_id: 0, account: 'alice', status: 'ACTIVE' }, { hider_id: 1, account: 'bob', status: 'ACTIVE' },
           { hider_id: 2, account: 'carol', status: 'CAPTURED' }],
  servers: [0, 1, 3].map((id) => ({ server_id: id, lights: off, metrics: frame(10 * id),
    history: Array.from({ length: 16 }, () => frame(10 * id)) })),
  events: [
    { type: 'SERVER_ADDED', tick: 0, revision: 3 },
    { type: 'SERVER_PROBED', tick: 11, revision: 10, server_id: 0, outcome: 'MISS' },
  ],
};