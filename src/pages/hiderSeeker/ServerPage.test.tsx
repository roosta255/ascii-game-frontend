// @vitest-environment jsdom
import { screen, within, fireEvent, waitFor } from '@testing-library/react';
import { renderAt, stubFetch, MATCH, HIDER_VIEW, PUBLIC_VIEW } from './testSupport';

describe('ServerPage', () => {
  it('HSUI-182: connected server', async () => {
    stubFetch({ '/views/hider/latest': HIDER_VIEW, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/servers/1');
    expect(await screen.findByRole('heading', { name: 'Server 1' })).toBeTruthy();
    expect(screen.getByText('HEAT · ERR ■ SEEK ■')).toBeTruthy();
    expect(screen.queryAllByRole('table').length).toBe(1);
    expect(within(screen.getByRole('table')).getAllByRole('row').length).toBe(8);
  });

  it('HSUI-182: connected to another server', async () => {
    stubFetch({ '/views/hider/latest': HIDER_VIEW, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/servers/0');
    expect(await screen.findByRole('heading', { name: 'Server 0' })).toBeTruthy();
    expect(screen.getByText('HEAT ■ ERR · SEEK ·')).toBeTruthy();
    expect(screen.queryAllByRole('table').length).toBe(0);
    expect(screen.getByText("Connect to see this server's metrics.")).toBeTruthy();
    expect(screen.getByText("You're connected to server 1.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy();
    expect(screen.getByText('On it: hider 1')).toBeTruthy();
    expect(screen.getByRole('link', { name: '#0' }).getAttribute('href')).toBe('/hs/m1/goals/0');
    expect(screen.getByRole('link', { name: 'Go to server 1' }).getAttribute('href')).toBe('/hs/m1/servers/1');
  });

  it('HSUI-182: Connect when not connected', async () => {
    const notConnected = { ...HIDER_VIEW, self: { ...HIDER_VIEW.self, server_id: null } };
    const fetchFn = stubFetch({ '/views/hider/latest': notConnected, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/servers/0');
    expect(await screen.findByRole('heading', { name: 'Server 0' })).toBeTruthy();
    const connectButton = screen.getByRole('button', { name: 'Connect (uses 1 of 4 team connections)' });
    expect(connectButton).toBeTruthy();
    // Check that button is not disabled by checking if it has the disabled attribute
    expect(connectButton.hasAttribute('disabled')).toBe(false);
    
    fireEvent.click(connectButton);
    const calls = fetchFn.mock.calls as unknown as [string, RequestInit | undefined][];
    await waitFor(() => expect(calls.some(([, init]) => init?.method === 'POST')).toBe(true));
    const post = calls.find(([, init]) => init?.method === 'POST')!;
    expect(JSON.parse(String(post[1]!.body)).intent).toEqual({ type: 'CONNECT', server_id: 0 });
  });

  it('HSUI-183: as a spectator', async () => {
    stubFetch({ '/views/public/latest': PUBLIC_VIEW, '/matches/m1': MATCH });
    renderAt('dave', '/hs/m1/servers/3');
    expect(await screen.findByRole('heading', { name: 'Server 3' })).toBeTruthy();
    expect(screen.getByText('HEAT · ERR · SEEK ·')).toBeTruthy();
    expect(within(screen.getByRole('table')).getAllByRole('row').length).toBe(8);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Remove server (1 LOA)' })).toBeNull();
    expect(screen.queryByText('Only hiders in this match can see this page.')).toBeNull();
  });

  it('HSUI-185: match over server', async () => {
    const completedView = { ...HIDER_VIEW, phase: 'COMPLETE' };
    stubFetch({ '/views/hider/latest': completedView, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/servers/1');
    expect(await screen.findByRole('heading', { name: 'Server 1' })).toBeTruthy();
    expect(screen.getByText('No moves: the match is over.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});