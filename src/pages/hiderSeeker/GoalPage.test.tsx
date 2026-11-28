// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { renderAt, stubFetch, MATCH, HIDER_VIEW, PUBLIC_VIEW } from './testSupport';

describe('GoalPage', () => {
  it('as alice (hider) for goal 0', async () => {
    stubFetch({ '/views/hider/latest': HIDER_VIEW, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/goals/0');
    
    // Wait for the status line
    expect(await screen.findByText('Pay goal now completes goal 1')).toBeTruthy();
    
    // Check that there is at most one table
    expect(screen.queryAllByRole('table').length).toBeLessThanOrEqual(1);
    
    // Check that the requirements table contains a row with "unknown (not connected)"
    const table = screen.getByRole('table');
    const rows = table.querySelectorAll('tr');
    let foundUnknownRow = false;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].textContent?.includes('unknown (not connected)')) {
        foundUnknownRow = true;
        break;
      }
    }
    expect(foundUnknownRow).toBe(true);
  });

  it('as a spectator', async () => {
    stubFetch({ '/views/public/latest': PUBLIC_VIEW, '/matches/m1': MATCH });
    renderAt('dave', '/hs/m1/goals/0');
    
    // Wait for the hider-only message
    expect(await screen.findByText('Only hiders in this match can see this page.')).toBeTruthy();
    
    // Check that there is at most one table
    expect(screen.queryAllByRole('table').length).toBeLessThanOrEqual(1);
  });
});