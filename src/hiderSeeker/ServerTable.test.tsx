// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import ServerTable from './ServerTable';

const metrics = { cpu: 25, memory: 1, disk: 2, network: 3, heat: 4, errors: 5, users: 6 };

describe('ServerTable', () => {
  it('renders a header row and one row per server, metrics in METRIC_ORDER', () => {
    render(<ServerTable servers={[{ server_id: 0, metrics }, { server_id: 2, metrics }]} />);
    const rows = screen.getAllByRole('row').map((row) => row.textContent);
    expect(rows).toEqual(['servercpumemorydisknetworkheaterrorsusers', '025123456', '225123456']);
  });

  it('renders only the header row when there are no servers', () => {
    render(<ServerTable servers={[]} />);
    expect(screen.getAllByRole('row')).toHaveLength(1);
  });

  it('renders sparklines for server history', () => {
    const serverWithHistory = {
      server_id: 3,
      metrics: { cpu: 25, memory: 1, disk: 2, network: 3, heat: 4, errors: 5, users: 6 },
      history: Array.from({ length: 16 }, (_, i) => ({
        cpu: i,
        memory: 0,
        disk: 0,
        network: 0,
        heat: 0,
        errors: 0,
        users: 0
      }))
    };
    
    render(<ServerTable servers={[serverWithHistory]} />);
    
    // Should have exactly 7 elements with role img (one for each metric)
    const imgElements = screen.getAllByRole('img');
    expect(imgElements).toHaveLength(7);
    
    // Should have the specific CPU sparkline with correct accessible name
    screen.getByRole('img', { 
      name: 'server 3 cpu history: 0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15' 
    });
    
    // Data row's text content should remain unchanged (but with extra spaces due to sparkline)
    const rows = screen.getAllByRole('row').map((row) => row.textContent);
    expect(rows[1]).toBe('3 25   1   2   3   4   5   6  ');
  });
});