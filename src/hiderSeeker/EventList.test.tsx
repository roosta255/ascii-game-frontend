// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import EventList from './EventList';

const SERVER_ADDED = { type: 'SERVER_ADDED', tick: 0, revision: 3 };
const SERVER_PROBED = { type: 'SERVER_PROBED', tick: 11, revision: 10, server_id: 0, outcome: 'MISS' };

describe('EventList', () => {
  it('shows "None." when events array is empty', async () => {
    render(<EventList events={[]} />);
    
    expect(screen.getByText('None.')).toBeTruthy();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('renders events in reverse order with correct text formatting', async () => {
    render(<EventList events={[SERVER_ADDED, SERVER_PROBED]} />);
    
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    // The events are reversed, so SERVER_PROBED (newer) comes first
    expect(items[0].textContent).toBe('Tick 11: seeker probed server 0, miss');
    expect(items[1].textContent).toBe('Tick 0: server added');
  });
});