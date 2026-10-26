// The rules object of a hider view, with the backend's values today.
const RULES = {
  ap_regen_per_tick: 2,
  ap_cap: 10,
  max_advance_ticks: 16,
  action_ap_costs: {
    ADD_SERVER: 0, REMOVE_SERVER: 0, CONFIGURE_SERVER: 5, SUPPRESS_ERROR: 3,
    BOOST_CPU: 2, ROTATE_ROUTE: 4, PAY_GOAL: 10, CONNECT: 0, DISCONNECT: 0,
  },
};

// The part of a hider view previewMove reads.
function viewWith(actionPoints: number, loa: number, rules: any = RULES) {
  return { self: { action_points: actionPoints, loa }, rules };
}

import { describe, it, expect } from 'vitest';
import * as turnPreview from './turnPreview';

describe('turnPreview module', () => {
  describe('ticksToAfford function', () => {
    it('should return 0 when current AP >= cost', () => {
      expect(turnPreview.ticksToAfford(4, 4, RULES)).toBe(0);
      expect(turnPreview.ticksToAfford(5, 2, RULES)).toBe(0);
    });

    it('should calculate correct ticks for various inputs', () => {
      expect(turnPreview.ticksToAfford(0, 10, RULES)).toBe(5);
      expect(turnPreview.ticksToAfford(1, 4, RULES)).toBe(2);
      expect(turnPreview.ticksToAfford(3, 5, RULES)).toBe(1);
    });

    it('should return null when cost exceeds AP_CAP', () => {
      expect(turnPreview.ticksToAfford(0, 11, RULES)).toBeNull();
    });
    
    it('should handle custom ap_regen_per_tick', () => {
      expect(turnPreview.ticksToAfford(0, 4, { ...RULES, ap_regen_per_tick: 1 })).toBe(4);
    });

    it('should return null when cost exceeds max_advance_ticks', () => {
      expect(turnPreview.ticksToAfford(0, 10, { ...RULES, max_advance_ticks: 4 })).toBeNull();
    });
  });

  describe('previewMove function', () => {
    it('should handle PLAY mode with 0 ticks', () => {
      const result = turnPreview.previewMove(viewWith(2, 1), 'BOOST_CPU', 'PLAY');
      expect(result).toEqual({
        ticks: 0,
        summary: 'Applies now. No ticks pass.'
      });
    });

    it('should handle PLAY mode with ticks', () => {
      const result = turnPreview.previewMove(viewWith(0, 1), 'PAY_GOAL', 'PLAY');
      expect(result).toEqual({
        ticks: 5,
        summary: 'Advances 5 ticks, then applies. The seeker acts each tick.'
      });
    });

    it('should handle QUEUE mode', () => {
      const result = turnPreview.previewMove(viewWith(1, 1), 'ROTATE_ROUTE', 'QUEUE');
      expect(result).toEqual({
        ticks: 2,
        summary: 'Queued. Applies after about 2 ticks, once a player advances time.'
      });
    });

    it('should handle unaffordable moves', () => {
      const result = turnPreview.previewMove(viewWith(10, 0), 'ADD_SERVER', 'PLAY');
      expect(result).toEqual({
        ticks: null,
        summary: 'Never affordable within 16 ticks.'
      });
    });

    it('should access ticks property correctly', () => {
      const result = turnPreview.previewMove(viewWith(0, 1), 'ADD_SERVER', 'PLAY');
      expect(result.ticks).toBe(0);
    });
    
    it('should handle custom action_ap_costs', () => {
      const result = turnPreview.previewMove(viewWith(0, 1, { ...RULES, action_ap_costs: { BOOST_CPU: 6 } }), 'BOOST_CPU', 'PLAY');
      expect(result.ticks).toBe(3);
    });
    
    it('should handle custom max_advance_ticks in summary', () => {
      const result = turnPreview.previewMove(viewWith(10, 0, { ...RULES, max_advance_ticks: 8 }), 'ADD_SERVER', 'PLAY');
      expect(result.summary).toBe('Never affordable within 8 ticks.');
    });
  });

  describe('tickCount function', () => {
    it('should format 0 ticks correctly', () => {
      expect(turnPreview.tickCount(0)).toBe('0 ticks');
    });

    it('should format 1 tick correctly', () => {
      expect(turnPreview.tickCount(1)).toBe('1 tick');
    });

    it('should format multiple ticks correctly', () => {
      expect(turnPreview.tickCount(3)).toBe('3 ticks');
    });
  });

  describe('previewPass function', () => {
    it('should create correct preview for 3 ticks', () => {
      const result = turnPreview.previewPass(3);
      expect(result).toEqual({
        ticks: 3,
        summary: 'Advances 3 ticks. The seeker acts each tick.'
      });
    });

    it('should access summary property correctly', () => {
      const result = turnPreview.previewPass(1);
      expect(result.summary).toBe('Advances 1 tick. The seeker acts each tick.');
    });
  });

  describe('describeMoveResult function', () => {
    it('should handle APPLIED status with pending applied and cancelled', () => {
      const body = {
        status: 'APPLIED',
        rule_outcome: 'APPLIED',
        tick: 7,
        ticks_advanced: 2,
        pending_applied: ['mv-3'],
        pending_cancelled: ['mv-4'],
        pending_cancelled_reasons: [{ intent_id: 'mv-4', reason: 'ADVANCE_LIMIT' }]
      };
      const result = turnPreview.describeMoveResult(body);
      expect(result).toEqual([
        'APPLIED: 2 ticks advanced, now tick 7.',
        'Pending applied: mv-3.',
        'Pending cancelled: mv-4 (ADVANCE_LIMIT).'
      ]);
    });

    it('should handle CANCELLED status with ACCEPTED rule_outcome', () => {
      const body = {
        status: 'CANCELLED',
        rule_outcome: 'ACCEPTED',
        tick: 0,
        ticks_advanced: 0,
        pending_cancelled: ['mv-4'],
        pending_cancelled_reasons: [{ intent_id: 'mv-4', reason: 'OWNER_CANCELLED' }]
      };
      const result = turnPreview.describeMoveResult(body);
      expect(result).toEqual([
        'CANCELLED: 0 ticks advanced, now tick 0.',
        'Pending cancelled: mv-4 (OWNER_CANCELLED).'
      ]);
    });

    it('should handle CANCELLED status with non-ACCEPTED rule_outcome', () => {
      const body = {
        status: 'CANCELLED',
        rule_outcome: 'ADVANCE_LIMIT',
        tick: 16,
        ticks_advanced: 1
      };
      const result = turnPreview.describeMoveResult(body);
      expect(result).toEqual([
        'CANCELLED: 1 tick advanced, now tick 16.',
        'Reason: ADVANCE_LIMIT.'
      ]);
    });

    it('should handle REJECTED status', () => {
      const body = {
        status: 'REJECTED',
        rule_outcome: 'REJECTED_INVALID_TARGET',
        tick: 0,
        ticks_advanced: 0
      };
      const result = turnPreview.describeMoveResult(body);
      expect(result).toEqual([
        'REJECTED: 0 ticks advanced, now tick 0.',
        'Reason: REJECTED_INVALID_TARGET.'
      ]);
    });
  });
});