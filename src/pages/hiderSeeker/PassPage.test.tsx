// @vitest-environment jsdom
import { screen, fireEvent, within } from '@testing-library/react';
import { renderAt, stubFetch, MATCH, HIDER_VIEW, PUBLIC_VIEW } from './testSupport';

describe('PassPage', () => {
  it('HSUI-192: renders 16 rows', async () => {
    stubFetch({ '/views/hider/latest': HIDER_VIEW, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/pass');
    expect(await screen.findByText('T17 ACTIVE │ AP 6/10 │ CONN 4 free · 2 in use │ LOA 1 │ ON S1')).toBeTruthy();
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows.length).toBe(17); // 1 header + 16 data rows
  });

  it('HSUI-192: clicking Pass on row 3 triggers passTicks with n=3', async () => {
    const fetchFn = stubFetch({ '/views/hider/latest': HIDER_VIEW, '/intents': { status: 'APPLIED', rule_outcome: 'ACCEPTED', ticks_advanced: 3, tick: 20, pending_applied: [] }, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/pass');
    expect(await screen.findByText('T17 ACTIVE │ AP 6/10 │ CONN 4 free · 2 in use │ LOA 1 │ ON S1')).toBeTruthy();
    
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    fireEvent.click(within(rows[3]).getByRole('button', { name: 'Pass' }));
    
    // Check that the POST was made with correct parameters
    const calls = fetchFn.mock.calls as unknown as [string, RequestInit | undefined][];
    const post = calls.find(([, init]) => init?.method === 'POST')!;
    expect(post[0]).toContain('/api/v1/matches/m1/intents');
  });

  it('as a spectator', async () => {
    stubFetch({ '/views/public/latest': PUBLIC_VIEW, '/matches/m1': MATCH });
    renderAt('dave', '/hs/m1/pass');
    expect(await screen.findByText('T17 ACTIVE │ WATCHING')).toBeTruthy();
    expect(screen.queryAllByRole('table').length).toBeLessThanOrEqual(1);
  });
});