import { describe, it, expect } from 'vitest';
import { buildMoveOptions, ownPendingMoves, goalText } from './moveOptions';

// A hider view with hider 0 on `serverId` (null: disconnected) and servers 0 and 1 active.
function viewOn(serverId: number | null) {
  return {
    self: { hider_id: 0, server_id: serverId },
    servers: [{ server_id: 0 }, { server_id: 1 }],
    pending: [
      { intent_id: 'mv-3', hider_id: 0, action: 'PAY_GOAL' },
      { intent_id: 'mv-4', hider_id: 1, action: 'BOOST_CPU' },
    ],
  };
}

describe('moveOptions', () => {
  describe('buildMoveOptions', () => {
    it('HSUI-020 (disconnected): returns correct options when disconnected', () => {
      const result = buildMoveOptions(viewOn(null));
      expect(result).toEqual([
        { label: 'Connect to server 0', intent: { type: 'CONNECT', server_id: 0 } },
        { label: 'Connect to server 1', intent: { type: 'CONNECT', server_id: 1 } },
        { label: 'Add a server (1 LOA)', intent: { type: 'ADD_SERVER' } },
        { label: 'Remove server 0', intent: { type: 'REMOVE_SERVER', server_id: 0 } },
        { label: 'Remove server 1', intent: { type: 'REMOVE_SERVER', server_id: 1 } },
      ]);
    });

    it('HSUI-021 (connected): returns correct options when connected', () => {
      const result = buildMoveOptions(viewOn(1));
      const intents = result.map(option => option.intent);
      
      expect(intents).toEqual([
        { type: 'DISCONNECT' },
        { type: 'CONFIGURE_SERVER' },
        { type: 'SUPPRESS_ERROR' },
        { type: 'BOOST_CPU' },
        { type: 'ROTATE_ROUTE' },
        { type: 'PAY_GOAL' },
        { type: 'ADD_SERVER' },
        { type: 'REMOVE_SERVER', server_id: 0 },
        { type: 'REMOVE_SERVER', server_id: 1 }
      ]);
      
      expect(result[0].label).toBe('Disconnect from server 1');
      expect(result[3].label).toBe('Boost CPU on server 1');
    });
  });

  describe('ownPendingMoves', () => {
    it('HSUI-022 (own pending): returns correct moves', () => {
      const result = ownPendingMoves(viewOn(null));
      expect(result.map((move: any) => move.intent_id)).toEqual(['mv-3']);
    });
  });

  describe('goalText', () => {
    it('HSUI-023 (goal text): returns correct formatted string', () => {
      const goal = {
        goal_id: 2,
        status: 'OPEN',
        reward_amount: 1,
        requirements: [
          { type: 'SERVER_METRIC_THRESHOLD', server_id: 0, metric: 'CPU', threshold: 40 },
          { type: 'ACTIVE_SERVER_COUNT', server_id: null, metric: null, threshold: 3 },
          { type: 'RESOURCE_MIN', server_id: null, metric: null, threshold: 5 }
        ]
      };
      
      const result = goalText(goal);
      expect(result).toBe('Goal 2 (OPEN, reward 1): server 0 CPU >= 40; at least 3 active servers; RESOURCE_MIN 5');
    });
  });
});