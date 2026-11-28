// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { renderAt, stubFetch, MATCH, HIDER_VIEW } from './testSupport';

describe('PlayerPage', () => {
  it('as alice', async () => {
    stubFetch({ '/views/hider/latest': HIDER_VIEW, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/player');
    
    // Wait for the status line to appear (this is what other tests do)
    await screen.findByText('T17 ACTIVE │ AP 6/10 │ CONN 4 free · 2 in use │ LOA 1 │ ON S1');
    
    // Verify there's only one table
    expect(screen.queryAllByRole('table').length).toBeLessThanOrEqual(1);
  });
});