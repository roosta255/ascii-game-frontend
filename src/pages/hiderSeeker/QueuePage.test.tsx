// @vitest-environment jsdom
import { screen, fireEvent, within } from '@testing-library/react';
import { renderAt, stubFetch, MATCH, HIDER_VIEW, PUBLIC_VIEW } from './testSupport';

describe('QueuePage', () => {
  it('HSUI-193: renders 2 rows', async () => {
    stubFetch({ '/views/hider/latest': HIDER_VIEW, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/queue');
    expect(await screen.findByText('T17 ACTIVE │ AP 6/10 │ CONN 4 free · 2 in use │ LOA 1 │ ON S1')).toBeTruthy();
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows.length).toBe(3); // 1 header + 2 data rows
  });

  it('HSUI-193: only row for alice shows Cancel button', async () => {
    stubFetch({ '/views/hider/latest': HIDER_VIEW, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/queue');
    expect(await screen.findByText('T17 ACTIVE │ AP 6/10 │ CONN 4 free · 2 in use │ LOA 1 │ ON S1')).toBeTruthy();
    
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    // First row (bob's) should not have a cancel button
    expect(within(rows[1]).queryByRole('button', { name: 'Cancel' })).toBeNull();
    // Second row (alice's) should have a cancel button
    expect(within(rows[2]).getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('HSUI-193: clicking Cancel sends request with correct intent id', async () => {
    const fetchFn = stubFetch({ '/views/hider/latest': HIDER_VIEW, '/intents': { status: 'CANCELLED', rule_outcome: 'ACCEPTED', pending_cancelled_reasons: [{ intent_id: 'mv-2', reason: 'cancelled' }] }, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/queue');
    expect(await screen.findByText('T17 ACTIVE │ AP 6/10 │ CONN 4 free · 2 in use │ LOA 1 │ ON S1')).toBeTruthy();
    
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    fireEvent.click(within(rows[2]).getByRole('button', { name: 'Cancel' }));
    
    // Check that the DELETE was made with correct parameters
    const calls = fetchFn.mock.calls as unknown as [string, RequestInit | undefined][];
    const deleteCall = calls.find(([, init]) => init?.method === 'DELETE')!;
    expect(deleteCall[0]).toContain('/api/v1/matches/m1/intents/mv-2');
  });

  it('HSUI-193: intent IDs never appear as visible text', async () => {
    stubFetch({ '/views/hider/latest': HIDER_VIEW, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/queue');
    expect(await screen.findByText('T17 ACTIVE │ AP 6/10 │ CONN 4 free · 2 in use │ LOA 1 │ ON S1')).toBeTruthy();
    
    const pageContent = screen.getByRole('table').textContent || '';
    expect(pageContent).not.toContain('mv-1');
    expect(pageContent).not.toContain('mv-2');
  });

  it('as a spectator', async () => {
    stubFetch({ '/views/public/latest': PUBLIC_VIEW, '/matches/m1': MATCH });
    renderAt('dave', '/hs/m1/queue');
    expect(await screen.findByText('T17 ACTIVE │ WATCHING')).toBeTruthy();
    expect(screen.queryAllByRole('table').length).toBeLessThanOrEqual(1);
  });
});