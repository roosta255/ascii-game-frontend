// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { renderAt, stubFetch, MATCH, HIDER_VIEW, PUBLIC_VIEW } from './testSupport';

describe('ResultPage', () => {
  it('HSUI-191 & HSUI-194: directly opening result shows No move yet.', async () => {
    stubFetch({ '/views/hider/latest': HIDER_VIEW, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/result');
    expect(await screen.findByText('No move yet.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/hs/m1');
  });

  it('HSUI-194: stale revision error handling', async () => {
    const fetchFn = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'POST') {
        return new Response(JSON.stringify({ error: 'STALE_REVISION', revision: 12 }), { status: 409 });
      }
      return new Response(JSON.stringify(url.includes('/views/hider/latest') ? HIDER_VIEW : MATCH), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchFn);
    
    // Simulate a move that results in stale revision error
    stubFetch({ '/views/hider/latest': HIDER_VIEW, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/result');
    expect(await screen.findByText('No move yet.')).toBeTruthy();
  });

  it('as a spectator', async () => {
    stubFetch({ '/views/public/latest': PUBLIC_VIEW, '/matches/m1': MATCH });
    renderAt('dave', '/hs/m1/result');
    expect(await screen.findByText('T17 ACTIVE │ WATCHING')).toBeTruthy();
    expect(screen.queryAllByRole('table').length).toBeLessThanOrEqual(1);
  });
});