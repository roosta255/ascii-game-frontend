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
});