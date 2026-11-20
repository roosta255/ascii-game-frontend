// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { renderAt, stubFetch, MATCH, HIDER_VIEW, PUBLIC_VIEW } from './testSupport';

describe('HubPage', () => {
  it('HSUI-171: a hider sees the status line, Hub, menu and no table', async () => {
    stubFetch({ '/views/hider/latest': HIDER_VIEW, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1');
    expect(await screen.findByText('T17 ACTIVE │ AP 6/10 │ CONN 4 free · 2 in use │ LOA 1 │ ON S1')).toBeTruthy();
    expect(screen.getByText(/Team reward 1 \/ 3/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Last result' })).toBeTruthy();
    expect(screen.queryAllByRole('table').length).toBe(0);
  });

  it('HSUI-172: lobby remains unchanged for both hub and rack routes when phase is LOBBY', async () => {
    stubFetch({ '/matches/m1': { ...MATCH, phase: 'LOBBY' } });
    renderAt('alice', '/hs/m1');
    expect(await screen.findByText('Match m1, lobby')).toBeTruthy();
    expect(screen.queryAllByRole('table').length).toBe(0);
    
    // Test the rack route too
    renderAt('alice', '/hs/m1/rack');
    expect(await screen.findByText('Match m1, lobby')).toBeTruthy();
    expect(screen.queryAllByRole('table').length).toBe(0);
  });

  it('HSUI-173: classic screen renders the existing HiderSeekerPage unchanged', async () => {
    stubFetch({ '/views/hider/latest': HIDER_VIEW, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/classic');
    // This test just verifies that it doesn't crash and renders something
    expect(await screen.findByText('Hider-Seeker')).toBeTruthy();
  });

  it('HSUI-174: ensure only one poll occurs when navigating from hub to result', async () => {
    const fetchMock = stubFetch({ '/views/hider/latest': HIDER_VIEW, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1');
    
    // Wait for the page to fully load and show the content
    await screen.findByText('T17 ACTIVE │ AP 6/10 │ CONN 4 free · 2 in use │ LOA 1 │ ON S1');
    
    // Verify initial fetch was called
    expect(fetchMock).toHaveBeenCalledTimes(2); // One for /matches/m1, one for /views/hider/latest
    
    // Find the "Last result" link and click it
    const lastResultLink = screen.getByRole('link', { name: 'Last result' });
    expect(lastResultLink).toBeTruthy();
    
    // Click the link to navigate to result page
    lastResultLink.click();
    
    // Wait a bit for any potential additional fetches
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify that no additional fetch to /matches/m1 occurred
    // The fetch mock should still have only the initial two calls
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});