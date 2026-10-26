import { describe, it, expect } from 'vitest';
import {
  ACTION_NAMES,
  METRIC_ORDER,
  actionName,
  serverText,
  matchSummary,
  selfSummary,
  teammateSummary,
  pendingSummary,
  publicHiderSummary,
  eventText
} from './viewText';

const view = {
  match_id: 'hs-1', phase: 'ACTIVE', tick: 3, revision: 9,
  self: { hider_id: 0, status: 'ACTIVE', action_points: 6, loa: 1, server_id: 0 },
};

describe('viewText', () => {
  it('exports ACTION_NAMES with correct mapping', () => {
    expect(ACTION_NAMES).toEqual({
      CONNECT: "Connect",
      DISCONNECT: "Disconnect",
      ADD_SERVER: "Add server",
      REMOVE_SERVER: "Remove server",
      CONFIGURE_SERVER: "Configure server",
      SUPPRESS_ERROR: "Suppress errors",
      BOOST_CPU: "Boost CPU",
      ROTATE_ROUTE: "Rotate route",
      PAY_GOAL: "Pay goal",
    });
  });

  it('exports METRIC_ORDER with correct order', () => {
    expect(METRIC_ORDER).toEqual(["cpu", "memory", "disk", "network", "heat", "errors", "users"]);
  });

  it('actionName returns display name for known types', () => {
    expect(actionName('BOOST_CPU')).toBe('Boost CPU');
    expect(actionName('SUPPRESS_ERROR')).toBe('Suppress errors');
    expect(actionName('PAY_GOAL')).toBe('Pay goal');
    expect(actionName('JUMP')).toBe('JUMP');
  });

  it('serverText returns correct text for server IDs', () => {
    expect(serverText(null)).toBe('disconnected');
    expect(serverText(2)).toBe('on server 2');
  });

  it('matchSummary returns correct match summary', () => {
    expect(matchSummary(view)).toBe('hs-1, ACTIVE, tick 3, revision 9');
  });

  it('selfSummary returns correct self summary', () => {
    expect(selfSummary(view)).toBe('Hider 0, ACTIVE, 6 AP, 1 LOA, on server 0');
  });

  it('teammateSummary returns correct teammate summaries', () => {
    expect(teammateSummary({ hider_id: 1, account: 'npc_1', status: 'ACTIVE', server_id: null })).toBe('Hider 1 (npc_1), ACTIVE, disconnected');
    expect(teammateSummary({ hider_id: 2, account: null, status: 'ACTIVE', server_id: 3 })).toBe('Hider 2 (open), ACTIVE, on server 3');
  });

  it('pendingSummary returns correct pending move summaries', () => {
    expect(pendingSummary({ intent_id: 'mv-5', hider_id: 1, action: 'PAY_GOAL', server_id: null, queue_position: 0 }, 0)).toBe('#1 Pay goal, hider 1, mv-5');
    expect(pendingSummary({ intent_id: 'mv-6', hider_id: 0, action: 'REMOVE_SERVER', server_id: 2, queue_position: 1 }, 0)).toBe('#2 Remove server 2, hider 0 (you), mv-6');
  });

  it('publicHiderSummary returns correct public hider summaries', () => {
    expect(publicHiderSummary({ hider_id: 1, account: 'bob', status: 'ACTIVE' })).toBe('Hider 1 (bob), ACTIVE');
    expect(publicHiderSummary({ hider_id: 2, account: null, status: 'NOT_JOINED' })).toBe('Hider 2 (open), NOT_JOINED');
  });

  it('eventText returns correct event texts', () => {
    expect(eventText({ type: 'SERVER_ADDED', tick: 3, revision: 7 })).toBe('Tick 3: server added');
    expect(eventText({ type: 'SERVER_REMOVED', tick: 3, revision: 7 })).toBe('Tick 3: server removed');
    expect(eventText({ type: 'SERVER_PROBED', tick: 4, revision: 8, server_id: 2, outcome: 'HIT' })).toBe('Tick 4: seeker probed server 2, hit');
    expect(eventText({ type: 'SERVER_PROBED', tick: 4, revision: 8, server_id: 0, outcome: 'MISS' })).toBe('Tick 4: seeker probed server 0, miss');
    expect(eventText({ type: 'SOMETHING_NEW', tick: 5, revision: 9 })).toBe('Tick 5: SOMETHING_NEW');
  });
});