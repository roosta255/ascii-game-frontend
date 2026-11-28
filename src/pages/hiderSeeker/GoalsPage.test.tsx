// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { renderAt, stubFetch, MATCH, HIDER_VIEW, PUBLIC_VIEW } from './testSupport';

describe('GoalsPage', () => {
  it('as alice (hider)', async () => {
    stubFetch({ '/views/hider/latest': HIDER_VIEW, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/goals');
    
    // Wait for the team reward line
    expect(await screen.findByText(/\d+ \/ \d+/)).toBeTruthy();
    
    // Check that there is at most one table
    expect(screen.queryAllByRole('table').length).toBeLessThanOrEqual(1);
    
    // Find goal 1 row and check it has READY text somewhere in the row
    const table = screen.getByRole('table');
    const rows = table.querySelectorAll('tr');
    
    // Skip header row (index 0)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      // Match goal 1 with OPEN status exactly
      if (row.textContent?.startsWith('1OPEN')) {
        // The READY text should be in the last cell of this row
        expect(row.textContent).toContain('READY');
        break;
      }
    }
  });

  it('as a spectator', async () => {
    stubFetch({ '/views/public/latest': PUBLIC_VIEW, '/matches/m1': MATCH });
    renderAt('dave', '/hs/m1/goals');
    
    // Wait for the hider-only message
    expect(await screen.findByText('Only hiders in this match can see this page.')).toBeTruthy();
    
    // Check that there is at most one table
    expect(screen.queryAllByRole('table').length).toBeLessThanOrEqual(1);
  });
});