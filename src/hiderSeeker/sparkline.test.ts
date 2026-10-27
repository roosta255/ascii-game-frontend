import { sparklinePoints } from "./sparkline";

describe('sparklinePoints', () => {
  it('calculates points for a simple case', () => {
    expect(sparklinePoints([0, 5, 10], 60, 20)).toBe('0,20 30,10 60,0');
  });

  it('handles all zeros case', () => {
    expect(sparklinePoints([0, 0, 0], 60, 20)).toBe('0,20 30,20 60,20');
  });

  it('handles mixed values', () => {
    expect(sparklinePoints([1, 2, 0], 60, 20)).toBe('0,10 30,0 60,20');
  });

  it('handles single value', () => {
    expect(sparklinePoints([7], 60, 20)).toBe('0,0');
  });

  it('handles multiple values', () => {
    expect(sparklinePoints([1, 2, 3, 4], 60, 20)).toBe('0,15 20,10 40,5 60,0');
  });
});