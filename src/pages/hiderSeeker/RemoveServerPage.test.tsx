// @vitest-environment jsdom
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderAt, stubFetch, MATCH, HIDER_VIEW, PUBLIC_VIEW } from './testSupport';

describe('RemoveServerPage', () => {
  it('HSUI-184: as alice, Play removes server 0', async () => {
    const fetchFn = stubFetch({ '/views/hider/latest': HIDER_VIEW, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/servers/0/remove');
    expect(await screen.findByText('T17 ACTIVE │ AP 6/10 │ CONN 4 free · 2 in use │ LOA 1 │ ON S1')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Remove server 0?' })).toBeTruthy();
    expect(screen.getByText('Costs 1 LOA (you have 1).')).toBeTruthy();
    expect(screen.getByText('Everyone on it is moved to server 1.')).toBeTruthy();
    expect(screen.getByText('Goals 0 are cancelled.')).toBeTruthy();
    expect(screen.queryAllByRole('table').length).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    const calls = fetchFn.mock.calls as unknown as [string, RequestInit | undefined][];
    await waitFor(() => expect(calls.some(([, init]) => init?.method === 'POST')).toBe(true));
    const post = calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(String(post[1]!.body)).intent).toEqual({ type: 'REMOVE_SERVER', server_id: 0 });
  });

  it('HSUI-184: Play and Queue are disabled with no LOA', async () => {
    const noLoa = { ...HIDER_VIEW, self: { ...HIDER_VIEW.self, loa: 0 } };
    stubFetch({ '/views/hider/latest': noLoa, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/servers/0/remove');
    expect(await screen.findByRole('heading', { name: 'Remove server 0?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Queue' }).hasAttribute('disabled')).toBe(true);
  });

  it('HSUI-184: a spectator sees the hider-only line', async () => {
    stubFetch({ '/views/public/latest': PUBLIC_VIEW, '/matches/m1': MATCH });
    renderAt('dave', '/hs/m1/servers/0/remove');
    expect(await screen.findByText('T17 ACTIVE │ WATCHING')).toBeTruthy();
    expect(screen.getByText('Only hiders in this match can see this page.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});