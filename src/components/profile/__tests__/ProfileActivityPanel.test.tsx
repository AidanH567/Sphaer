import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ProfileActivityPanel } from '@/components/profile/ProfileActivityPanel';
import { buildActivityTabs } from '@/utils/profile-activities';
import type { EventWithRelations } from '@/types/event.types';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('expo-image', () => {
  const ReactLib = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Image: (props: Record<string, unknown>) => ReactLib.createElement(View, props),
  };
});

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

const HOUR = 60 * 60 * 1000;
const soon = (h: number) => new Date(Date.now() + h * HOUR).toISOString();

function makeEvent(
  id: string,
  title: string,
  over: Partial<EventWithRelations> = {},
): EventWithRelations {
  return {
    id,
    title,
    starts_at: soon(2),
    is_free: true,
    price: null,
    ticket_url: null,
    poster_url: null,
    creator: null,
    circle: null,
    ...over,
  } as EventWithRelations;
}

const GOING = [
  makeEvent('g1', 'Warehouse Night', { is_free: false }),
  makeEvent('g2', 'Free Jam'),
];
const SAVED = [makeEvent('s1', 'Riso Workshop')];

const ownTabs = buildActivityTabs({ going: GOING, saved: SAVED, isOwnProfile: true });
const emptyTabs = buildActivityTabs({ going: [], saved: [], isOwnProfile: true });

describe('ProfileActivityPanel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows every tab at once, so nothing is hidden behind a guess', () => {
    render(<ProfileActivityPanel tabs={ownTabs} isLoading={false} />);
    expect(screen.getByLabelText('All, 3')).toBeTruthy();
    expect(screen.getByLabelText('Going, 2')).toBeTruthy();
    expect(screen.getByLabelText('Saved, 1')).toBeTruthy();
    expect(screen.getByLabelText('Tickets, 1')).toBeTruthy();
  });

  it('opens on the All tab', () => {
    render(<ProfileActivityPanel tabs={ownTabs} isLoading={false} />);
    // All = going ∪ saved, so the saved-only activity is present too.
    expect(screen.getByText('Riso Workshop')).toBeTruthy();
    expect(screen.getByText('Warehouse Night')).toBeTruthy();
  });

  it('swaps the list in place when a tab is selected — no sheet opens', () => {
    render(<ProfileActivityPanel tabs={ownTabs} isLoading={false} />);
    fireEvent.press(screen.getByLabelText('Tickets, 1'));
    expect(screen.getByText('Warehouse Night')).toBeTruthy();
    expect(screen.queryByText('Free Jam')).toBeNull();
    expect(screen.queryByText('Riso Workshop')).toBeNull();
  });

  it('marks a ticketed row outside the Tickets tab', () => {
    render(<ProfileActivityPanel tabs={ownTabs} isLoading={false} />);
    expect(screen.getByText('Ticket')).toBeTruthy();
  });

  it('drops the redundant badge inside the Tickets tab', () => {
    render(<ProfileActivityPanel tabs={ownTabs} isLoading={false} />);
    fireEvent.press(screen.getByLabelText('Tickets, 1'));
    expect(screen.queryByText('Ticket')).toBeNull();
  });

  it('routes to the activity when a row is tapped', () => {
    render(<ProfileActivityPanel tabs={ownTabs} isLoading={false} />);
    fireEvent.press(screen.getByText('Warehouse Night'));
    expect(mockPush).toHaveBeenCalledWith('/event/g1');
  });

  describe('empty states', () => {
    it('gives a considered message rather than a blank panel', () => {
      render(<ProfileActivityPanel tabs={emptyTabs} isLoading={false} />);
      expect(
        screen.getByText(
          'Nothing here yet — activities you join or save will show up in this list.'
        )
      ).toBeTruthy();
    });

    it('gives each tab its OWN empty message', () => {
      render(<ProfileActivityPanel tabs={emptyTabs} isLoading={false} />);
      fireEvent.press(screen.getByLabelText('Tickets, 0'));
      expect(screen.getByText(/No tickets yet/)).toBeTruthy();
    });

    it('still shows the tab strip when everything is empty', () => {
      render(<ProfileActivityPanel tabs={emptyTabs} isLoading={false} />);
      expect(screen.getByLabelText('Saved, 0')).toBeTruthy();
    });
  });

  it('renders nothing when there are no tabs at all', () => {
    render(<ProfileActivityPanel tabs={[]} isLoading={false} />);
    expect(screen.queryByTestId('profile-activity-panel')).toBeNull();
  });

  it('surfaces an error instead of pretending the list is empty', () => {
    render(<ProfileActivityPanel tabs={emptyTabs} isLoading={false} error="Could not load activities" />);
    expect(screen.getByText('Could not load activities')).toBeTruthy();
  });
});
