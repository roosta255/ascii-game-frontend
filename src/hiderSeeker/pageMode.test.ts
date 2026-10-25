import { describe, it, expect } from 'vitest';
import { pageMode } from './pageMode';

// A getMatch body in `phase` with alice in slot 0 and the NPC npc_1 in slot 1.
function matchIn(phase: string) {
  return { phase, hiders: [{ hider_id: 0, account: 'alice' }, { hider_id: 1, account: 'npc_1' }] };
}

describe('pageMode', () => {
  it('returns LOBBY when match.phase is LOBBY', () => {
    expect(pageMode(matchIn('LOBBY'), 'alice')).toBe('LOBBY');
    expect(pageMode(matchIn('LOBBY'), 'bob')).toBe('LOBBY');
  });

  it('returns PLAY when account is in hiders list', () => {
    expect(pageMode(matchIn('ACTIVE'), 'alice')).toBe('PLAY');
    expect(pageMode(matchIn('COMPLETE'), 'alice')).toBe('PLAY');
  });

  it('returns NOT_A_HIDER when account is not in hiders list', () => {
    expect(pageMode(matchIn('ACTIVE'), 'bob')).toBe('NOT_A_HIDER');
  });
});