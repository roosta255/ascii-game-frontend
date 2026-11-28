export function requirementText(req: any): string {
  if (req.type === 'SERVER_METRIC_THRESHOLD') {
    return `S${req.server_id} ${req.metric} >= ${req.threshold}`;
  } else if (req.type === 'ACTIVE_SERVER_COUNT') {
    return `at least ${req.threshold} active servers`;
  } else {
    return `${req.type} ${req.threshold}`;
  }
}

export function requirementStatus(view: any, req: any): string {
  if (req.type === 'ACTIVE_SERVER_COUNT') {
    return view.servers.length >= req.threshold ? 'met' : 'not met';
  } else if (req.type === 'SERVER_METRIC_THRESHOLD') {
    const server = view.servers.find((s: any) => s.server_id === req.server_id);
    if (!server) {
      return 'server removed';
    }
    if (server.metrics === null) {
      return 'unknown (not connected)';
    }
    const metricValue = server.metrics[req.metric.toLowerCase()];
    if (metricValue === undefined) {
      return 'unknown (not connected)';
    }
    return metricValue >= req.threshold ? 'met' : 'not met';
  } else {
    return 'unknown';
  }
}

export function isReady(view: any, goal: { goal_id: number }): boolean {
  return goal.goal_id === view.completable_goal_id;
}