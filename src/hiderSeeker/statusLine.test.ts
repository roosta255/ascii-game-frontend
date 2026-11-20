import { describe, it, expect } from 'vitest';
import { connectionCounts, hiderStatusLine, spectatorStatusLine, moveBlockedReason } from './statusLine';
import { HIDER_VIEW, PUBLIC_VIEW } from '../pages/hiderSeeker/testSupport';

describe('connectionCounts', () => {
  it('calculates connection counts correctly', () => {
    expect(connectionCounts(HIDER_VIEW)).toEqual({ available: 4, inUse: 2, lost: 3, total: 9 });
  });
  
  it('HSUI-170b (lost is never negative)', () => {
    // Create a view where team_connections equals team_connections_total
    const view = {
      ...HIDER_VIEW,
      team_connections: 9,
      team_connections_total: 9
    };
    
    const counts = connectionCounts(view);
    expect(counts.lost).toBe(0);
  });
});

describe('hiderStatusLine', () => {
  it('generates the correct status line for a connected hider', () => {
    expect(hiderStatusLine(HIDER_VIEW)).toBe('T17 ACTIVE │ AP 6/10 │ CONN 4 free · 2 in use │ LOA 1 │ ON S1');
  });

  it('generates the correct status line for a disconnected hider', () => {
    const disconnectedView = {
      ...HIDER_VIEW,
      self: { ...HIDER_VIEW.self, server_id: null },
    };

    expect(hiderStatusLine(disconnectedView)).toBe('T17 ACTIVE │ AP 6/10 │ CONN 4 free · 1 in use │ LOA 1 │ OFF');
  });
  
  it('HSUI-170a', () => {
    // Create a view based on HIDER_VIEW but with seeker_connected = false
    const view = {
      ...HIDER_VIEW,
      servers: HIDER_VIEW.servers.map(s => 
        s.server_id === 1 ? { ...s, lights: { ...s.lights, seeker_connected: false } } : s
      )
    };

    expect(hiderStatusLine(view)).toBe('T17 ACTIVE │ AP 6/10 │ CONN 4 free · 2 in use │ LOA 1 │ ON S1');
  });
});

describe('spectatorStatusLine', () => {
  it('generates the correct status line for a spectator', () => {
    expect(spectatorStatusLine(PUBLIC_VIEW)).toBe('T17 ACTIVE │ WATCHING');
  });
});

describe('moveBlockedReason', () => {
  it('returns null when moves are allowed', () => {
    expect(moveBlockedReason(HIDER_VIEW)).toBeNull();
  });

  it('returns the correct reason when the match is complete', () => {
    const completedView = { ...HIDER_VIEW, phase: 'COMPLETE' };
    expect(moveBlockedReason(completedView)).toBe('No moves: the match is over.');
  });

  it('returns the correct reason when the hider is not active', () => {
    const capturedView = { ...HIDER_VIEW, self: { ...HIDER_VIEW.self, status: 'CAPTURED' } };
    expect(moveBlockedReason(capturedView)).toBe('No moves: you are CAPTURED.');
  });
});