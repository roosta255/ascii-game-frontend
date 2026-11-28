// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { resourceRows } from './playerResources';
import { HIDER_VIEW } from '../pages/hiderSeeker/testSupport';

describe('resourceRows', () => {
  it('returns exactly seven objects with correct values for the hider view', () => {
    const rows = resourceRows(HIDER_VIEW);
    
    expect(rows).toHaveLength(7);
    
    // Check the exact values as specified in the requirements
    expect(rows[0].value).toBe("6"); // Action points
    expect(rows[1].value).toBe("1"); // LOA
    expect(rows[2].value).toBe("4"); // Connections available
    expect(rows[3].value).toBe("2"); // Connections in use
    expect(rows[4].value).toBe("3"); // Connections lost
    expect(rows[5].value).toBe("9"); // Connections total
    expect(rows[6].value).toBe("1 / 3"); // Team reward
    
    // Check that connections lost is never negative (it should be 3 in this case)
    expect(parseInt(rows[4].value)).toBeGreaterThanOrEqual(0);
  });
});