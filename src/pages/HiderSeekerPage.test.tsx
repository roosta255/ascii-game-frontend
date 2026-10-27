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