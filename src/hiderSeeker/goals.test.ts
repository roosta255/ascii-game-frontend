// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { HIDER_VIEW } from '../pages/hiderSeeker/testSupport';
import { requirementText, requirementStatus, isReady } from './goals';

describe('requirementText', () => {
  it('formats SERVER_METRIC_THRESHOLD requirements correctly', () => {
    const req = { type: 'SERVER_METRIC_THRESHOLD', server_id: 0, metric: 'CPU', threshold: 40 };
    expect(requirementText(req)).toBe('S0 CPU >= 40');
  });

  it('formats ACTIVE_SERVER_COUNT requirements correctly', () => {
    const req = { type: 'ACTIVE_SERVER_COUNT', server_id: null, metric: null, threshold: 3 };
    expect(requirementText(req)).toBe('at least 3 active servers');
  });

  it('formats other requirement types correctly', () => {
    const req = { type: 'SOME_OTHER_TYPE', server_id: null, metric: null, threshold: 5 };
    expect(requirementText(req)).toBe('SOME_OTHER_TYPE 5');
  });
});

describe('requirementStatus', () => {
  it('returns "unknown (not connected)" for Goal 0 requirement (server 0 with null metrics)', () => {
    const req = { type: 'SERVER_METRIC_THRESHOLD', server_id: 0, metric: 'CPU', threshold: 40 };
    expect(requirementStatus(HIDER_VIEW, req)).toBe('unknown (not connected)');
  });

  it('returns "met" for Goal 1 requirement (server 1, NETWORK >= 3, network value is 3)', () => {
    const req = { type: 'SERVER_METRIC_THRESHOLD', server_id: 1, metric: 'NETWORK', threshold: 3 };
    expect(requirementStatus(HIDER_VIEW, req)).toBe('met');
  });

  it('returns "met" for Goal 2 requirement (at least 3 servers, exactly 3 listed)', () => {
    const req = { type: 'ACTIVE_SERVER_COUNT', server_id: null, metric: null, threshold: 3 };
    expect(requirementStatus(HIDER_VIEW, req)).toBe('met');
  });

  it('returns "server removed" for requirement on server 7 (not in view)', () => {
    const req = { type: 'SERVER_METRIC_THRESHOLD', server_id: 7, metric: 'CPU', threshold: 40 };
    expect(requirementStatus(HIDER_VIEW, req)).toBe('server removed');
  });
});

describe('isReady', () => {
  it('returns true only for Goal 1 (completable_goal_id is 1)', () => {
    expect(isReady(HIDER_VIEW, { goal_id: 0 })).toBe(false);
    expect(isReady(HIDER_VIEW, { goal_id: 1 })).toBe(true);
    expect(isReady(HIDER_VIEW, { goal_id: 2 })).toBe(false);
  });
});