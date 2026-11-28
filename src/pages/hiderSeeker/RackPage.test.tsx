// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { renderAt, stubFetch, MATCH, HIDER_VIEW, PUBLIC_VIEW } from './testSupport';

describe('RackPage', () => {
  it('as alice', async () => {
    stubFetch({ '/views/hider/latest': HIDER_VIEW, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/rack');
    expect(await screen.findByText('T17 ACTIVE │ AP 6/10 │ CONN 4 free · 2 in use │ LOA 1 │ ON S1')).toBeTruthy();
    expect(screen.queryAllByRole('table').length).toBeLessThanOrEqual(1);
    
    // Check table has 17 rows (header + 16 slots)
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBe(17);
    
    // Check server 1 row has correct light values
    const server1Row = rows[2]; // Index 2 because index 0 is header, 1 is server 0
    expect(server1Row.textContent).toContain('S1');
    expect(server1Row.textContent).toContain('HEAT ·');
    expect(server1Row.textContent).toContain('ERR ■');
    expect(server1Row.textContent).toContain('SEEK ■');
    
    // Check server 0 row has correct occupancy
    const server0Row = rows[1];
    expect(server0Row.textContent).toContain('S0');
    expect(server0Row.textContent).toContain('+1');
    
    // Check server 1 row has "YOU" occupancy
    const server1OccupancyRow = rows[2];
    expect(server1OccupancyRow.textContent).toContain('YOU');
    
    // Check slot 2 is empty
    const emptySlotRow = rows[3];
    expect(emptySlotRow.textContent).toContain('S2');
    expect(emptySlotRow.textContent).toContain('empty');
    
    // Check link href for server 0
    const server0Link = within(server0Row).getByRole('link');
    expect(server0Link.getAttribute('href')).toBe('/hs/m1/servers/0');
    
    // Check add server button exists
    const addButton = screen.getByText('Add server (1 LOA)');
    expect(addButton).toBeTruthy();
    
    // Check preview summary exists
    const previewSummary = screen.getByText(/Add server \(1 LOA\)/);
    expect(previewSummary).toBeTruthy();
    
    // Check Play and Queue buttons exist
    const playButton = screen.getByText('Play');
    const queueButton = screen.getByText('Queue');
    expect(playButton).toBeTruthy();
    expect(queueButton).toBeTruthy();
    
    // Check buttons are disabled when loa < 1 (this should be false since loa is 1)
    expect(playButton.hasAttribute('disabled')).toBe(false);
    expect(queueButton.hasAttribute('disabled')).toBe(false);
  });

  it('as a spectator', async () => {
    stubFetch({ '/views/public/latest': PUBLIC_VIEW, '/matches/m1': MATCH });
    renderAt('dave', '/hs/m1/rack');
    expect(await screen.findByText('T17 ACTIVE │ WATCHING')).toBeTruthy();
    expect(screen.queryAllByRole('table').length).toBeLessThanOrEqual(1);
    
    // Check table has 17 rows (header + 16 slots)
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(rows.length).toBe(17);
    
    // Check server 1 row has correct light values
    const server1Row = rows[2]; // Index 2 because index 0 is header, 1 is server 0
    expect(server1Row.textContent).toContain('S1');
    expect(server1Row.textContent).toContain('HEAT ·');
    expect(server1Row.textContent).toContain('ERR ·');
    expect(server1Row.textContent).toContain('SEEK ·');
    
    // Check slot 2 is empty
    const emptySlotRow = rows[3];
    expect(emptySlotRow.textContent).toContain('S2');
    expect(emptySlotRow.textContent).toContain('empty');
    
    // Check no occupancy column
    expect(server1Row.textContent).not.toContain('YOU');
    expect(server1Row.textContent).not.toContain('+1');
    
    // Check no add server button
    const addButton = screen.queryByText('Add server (1 LOA)');
    expect(addButton).toBeNull();
  });

  it('shows match over state correctly', async () => {
    const completeView = { ...HIDER_VIEW, phase: 'COMPLETE' };
    stubFetch({ '/views/hider/latest': completeView, '/matches/m1': MATCH });
    renderAt('alice', '/hs/m1/rack');
    
    // Check table still exists
    const table = screen.getByRole('table');
    expect(table).toBeTruthy();
    
    // Check status line shows match over message (this should be rendered by the layout)
    const statusLine = screen.getByText('No moves: the match is over.');
    expect(statusLine).toBeTruthy();
    
    // Check Play and Queue buttons are not present
    const playButton = screen.queryByText('Play');
    const queueButton = screen.queryByText('Queue');
    expect(playButton).toBeNull();
    expect(queueButton).toBeNull();
  });
});