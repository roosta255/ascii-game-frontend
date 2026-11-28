// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { renderAt, stubFetch, MATCH, HIDER_VIEW } from './testSupport';

describe('TeamPage', () => {
  it('HSUI-202b: as alice, bob links to his server', async () => {
    stubFetch({ '/views/hider/latest': HIDER_VIEW, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/team');
    expect(await screen.findByText('T17 ACTIVE │ AP 6/10 │ CONN 4 free · 2 in use │ LOA 1 │ ON S1')).toBeTruthy();
    expect(screen.queryAllByRole('table').length).toBeLessThanOrEqual(1);
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows.length).toBe(3);
    const bob = rows[1];
    expect(bob.textContent).toContain('bob');
    expect(within(bob).getByRole('link', { name: 'server 0' }).getAttribute('href')).toBe('/hs/m1/servers/0');
    expect(rows[2].textContent).toContain('disconnected');
    expect(within(rows[2]).queryByRole('link')).toBeNull();
  });
});