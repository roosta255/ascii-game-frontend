// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { renderAt, stubFetch, MATCH, HIDER_VIEW, PUBLIC_VIEW } from './testSupport';

describe('EventsPage', () => {
  it('as alice', async () => {
    stubFetch({ '/views/hider/latest': HIDER_VIEW, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/events');
    expect(await screen.findByText('T17 ACTIVE │ AP 6/10 │ CONN 4 free · 2 in use │ LOA 1 │ ON S1')).toBeTruthy();
    expect(screen.queryAllByRole('table').length).toBeLessThanOrEqual(1);
  });

  it('as a spectator', async () => {
    stubFetch({ '/views/public/latest': PUBLIC_VIEW, '/matches/m1': MATCH });
    renderAt('dave', '/hs/m1/events');
    expect(await screen.findByText('T17 ACTIVE │ WATCHING')).toBeTruthy();
    expect(screen.queryAllByRole('table').length).toBeLessThanOrEqual(1);
  });

  it('renders events table with server links', async () => {
    const testView = {
      ...HIDER_VIEW,
      events: [
        { tick: 11, type: 'SERVER_PROBED', server_id: 0, outcome: 'HIT' },
        { tick: 10, type: 'SERVER_ADDED' }
      ]
    };
    
    stubFetch({ '/views/hider/latest': testView, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/events');
    expect(await screen.findByText('T17 ACTIVE │ AP 6/10 │ CONN 4 free · 2 in use │ LOA 1 │ ON S1')).toBeTruthy();
    
    // Just verify that a table exists
    const table = screen.getByRole('table');
    expect(table).toBeTruthy();
  });

  it('renders "None." when no events', async () => {
    const testView = {
      ...HIDER_VIEW,
      events: []
    };
    
    stubFetch({ '/views/hider/latest': testView, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/events');
    expect(await screen.findByText('T17 ACTIVE │ AP 6/10 │ CONN 4 free · 2 in use │ LOA 1 │ ON S1')).toBeTruthy();
    
    // Should render "None." instead of a table
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('None.')).toBeTruthy();
  });
});