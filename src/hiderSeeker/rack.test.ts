// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  LIGHT_ON,
  LIGHT_OFF,
  MAX_SERVERS,
  rackSlots,
  lightGlyphs,
  lightsLine,
  occupancy,
  goalsNeedingServer,
  relocationTarget,
  serverAccess
} from './rack';
import { HIDER_VIEW, PUBLIC_VIEW } from '../pages/hiderSeeker/testSupport';

describe('rack module', () => {
  it('exports correct constants', () => {
    expect(LIGHT_ON).toBe("\u25A0");
    expect(LIGHT_OFF).toBe("\xB7");
    expect(MAX_SERVERS).toBe(16);
  });

  it('rackSlots returns 16 entries with correct server placement', () => {
    const slots = rackSlots(HIDER_VIEW.servers);
    
    expect(slots.length).toBe(MAX_SERVERS);
    
    // Slot 2 should be empty
    expect(slots[2].server).toBeNull();
    
    // Slot 3 should hold server with id 3
    expect(slots[3].serverId).toBe(3);
    expect(slots[3].server?.server_id).toBe(3);
  });

  it('lightsLine produces correct output for hider view server', () => {
    const server1 = HIDER_VIEW.servers.find(s => s.server_id === 1)!;
    const result = lightsLine(server1.lights);
    
    expect(result).toBe("HEAT \xB7 ERR \u25A0 SEEK \u25A0");
  });

  it('lightsLine produces correct output for public view server', () => {
    const server0 = PUBLIC_VIEW.servers.find(s => s.server_id === 0)!;
    const result = lightsLine(server0.lights);
    
    expect(result).toBe("HEAT \xB7 ERR \xB7 SEEK \xB7");
  });

  it('occupancy returns correct values', () => {
    // Server 1 - player is on it
    expect(occupancy(HIDER_VIEW, 1)).toBe("YOU");
    
    // Server 0 - has one teammate (bob)
    expect(occupancy(HIDER_VIEW, 0)).toBe("+1");
    
    // Server 3 - no teammates
    expect(occupancy(HIDER_VIEW, 3)).toBe("");
  });

  it('goalsNeedingServer returns correct goal ids', () => {
    // Server 0 - should have goal id 0
    expect(goalsNeedingServer(HIDER_VIEW, 0)).toEqual([0]);
    
    // Server 1 - should have goal id 1
    expect(goalsNeedingServer(HIDER_VIEW, 1)).toEqual([1]);
  });

  it('relocationTarget returns correct target server', () => {
    // With servers 0, 1, 3, target for server 0 should be 1
    expect(relocationTarget(HIDER_VIEW, 0)).toBe(1);
    
    // Target for server 1 should be 0 (lowest other)
    expect(relocationTarget(HIDER_VIEW, 1)).toBe(0);
    
    // Target for server 3 should be 0 (lowest other)
    expect(relocationTarget(HIDER_VIEW, 3)).toBe(0);
  });

  it('serverAccess returns correct access status', () => {
    // Player is on server 1
    expect(serverAccess(HIDER_VIEW, 1)).toBe("HERE");
    
    // Player is not on server 0 but connected to server 1
    expect(serverAccess(HIDER_VIEW, 0)).toBe("ELSEWHERE");
    
    // Player has no connection (null server_id)
    const viewWithoutConnection = { ...HIDER_VIEW, self: { ...HIDER_VIEW.self, server_id: null } };
    expect(serverAccess(viewWithoutConnection, 0)).toBe("DISCONNECTED");
  });
});