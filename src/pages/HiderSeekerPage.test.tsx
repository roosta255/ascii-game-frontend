// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../AuthContext';
import HiderSeekerPage from './HiderSeekerPage';

// Answers each request with the body registered for the first matching URL fragment.
function stubFetch(bodies: Record<string, unknown>) {
  const fetchFn = vi.fn(async (url: string) => {
    const key = Object.keys(bodies).find((fragment) => url.includes(fragment));
    return new Response(key ? JSON.stringify(bodies[key]) : '{}', { status: key ? 200 : 404 });
  });
  vi.stubGlobal('fetch', fetchFn);
  return fetchFn;
}

// Renders /hs/<matchId> logged in as account.
function renderPage(account: string, matchId: string) {
  localStorage.setItem('currentAccount', account);
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[`/hs/${matchId}`]}>
        <Routes>
          <Route path="/hs/:matchId" element={<HiderSeekerPage />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>
  );
}

const MATCH = { match_id: 'm1', phase: 'ACTIVE', revision: 11, host: 'alice', hiders: [{ hider_id: 0, account: 'alice' }] };
const PUBLIC_VIEW = {
  match_id: 'm1', phase: 'ACTIVE', tick: 15, revision: 11, winner: null,
  hiders: [{ hider_id: 0, account: 'alice', status: 'ACTIVE' }],
  servers: [],
  events: [
    { type: 'SERVER_ADDED', tick: 0, revision: 3 },
    { type: 'SERVER_PROBED', tick: 11, revision: 10, server_id: 0, outcome: 'HIT' },
  ],
};
const HIDER_VIEW = {
  match_id: 'm1', phase: 'ACTIVE', tick: 15, revision: 11, winner: null,
  hider_id: 0,
  self: { hider_id: 0, account: 'alice', status: 'ACTIVE', action_points: 4, server_id: null, loa: 1, resources: [1, 0, 0] },
  team: [], pending: [], team_connections: 3, goals: [], team_reward: 0, reward_target: 100,
  rules: { ap_regen_per_tick: 2, ap_cap: 10, max_advance_ticks: 16, action_ap_costs: { CONNECT: 0 } },
  servers: [{ server_id: 0, metrics: { cpu: 25, memory: 0, disk: 0, network: 0, heat: 0, errors: 0, users: 0 } }],
  events: [
    { type: 'SERVER_ADDED', tick: 0, revision: 3 },
    { type: 'SERVER_PROBED', tick: 11, revision: 10, server_id: 0, outcome: 'MISS' },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('HiderSeekerPage spectator screen', () => {
  it('shows the public view to an account that is not a hider, events newest first', async () => {
    const fetchFn = stubFetch({ '/views/public/latest': PUBLIC_VIEW, '/matches/m1': MATCH });
    renderPage('carol', 'm1');
    expect(await screen.findByText('You are watching. You are not a hider in this match.')).toBeTruthy();
    expect(screen.getByText('Hider 0 (alice), ACTIVE')).toBeTruthy();
    expect(screen.getAllByRole('listitem').map((item) => item.textContent).slice(-2))
      .toEqual(['Tick 11: seeker probed server 0, hit', 'Tick 0: server added']);
    expect(fetchFn.mock.calls.some(([url]) => url.includes('/views/hider/'))).toBe(false);
  });
});

describe('HiderSeekerPage play screen', () => {
  it('shows events on the hider\'s play screen in the correct order', async () => {
    const fetchFn = stubFetch({ '/views/hider/latest': HIDER_VIEW, '/matches/m1': MATCH });
    renderPage('alice', 'm1');
    
    // Wait for Moves heading to appear
    expect(await screen.findByText('Moves')).toBeTruthy();
    
    // Check that Events heading is present
    expect(screen.getByText('Events')).toBeTruthy();
    
    // Check the event list items
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toBe('Tick 11: seeker probed server 0, miss');
    expect(items[1].textContent).toBe('Tick 0: server added');
    
    // Verify no request URL contains /views/public/
    expect(fetchFn.mock.calls.some(([url]) => url.includes('/views/public/'))).toBe(false);
  });
});