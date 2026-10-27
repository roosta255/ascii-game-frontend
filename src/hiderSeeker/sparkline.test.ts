import { describe, it, expect } from 'vitest';
import { sparklinePoints } from './sparkline';

describe('sparklinePoints', () => {
  it('returns correct points for [0, 5, 10], width 60, height 20', () => {
    expect(sparklinePoints([0, 5, 10], 60, 20)).toBe('0,20 30,10 60,0');
  });

  it('returns correct points for [0, 0, 0], width 60, height 20', () => {
    expect(sparklinePoints([0, 0, 0], 60, 20)).toBe('0,20 30,20 60,20');
  });

  it('returns correct points for [1, 2, 0], width 60, height 20', () => {
    expect(sparklinePoints([1, 2, 0], 60, 20)).toBe('0,10 30,0 60,20');
  });

  it('returns correct points for [7], width 60, height 20', () => {
    expect(sparklinePoints([7], 60, 20)).toBe('0,0');
  });

  it('returns correct points for [1, 2, 3, 4], width 60, height 20', () => {
    expect(sparklinePoints([1, 2, 3, 4], 60, 20)).toBe('0,15 20,10 40,5 60,0');
  });
});