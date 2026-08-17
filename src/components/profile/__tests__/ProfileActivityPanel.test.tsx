import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ProfileActivityPanel } from '@/components/profile/ProfileActivityPanel';
import { buildActivityTabs } from '@/utils/profile-activities';
import type { EventWithRelations } from '@/types/event.types';

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
const ago = (h: number) => new Date(Date.now() - h * HOUR).toISOString();

function makeEvent(
  id: string,
  title: string,
  startsAt: string,
  over: Partial<EventWithRelations> = {},
): EventWithRelations {
  return {
    id,
    title,
    starts_at: startsAt,
    ends_at: null,
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
  makeEvent('g1', 'Warehouse Night', soon(2), { is_free: false }), // ticketed
  makeEvent('g2', 'Free Jam', soon(3)),
  makeEvent('g3', 'Last Winter Show', ago(48)), // finished
];
const SAVED = [makeEvent('s1', 'Riso Workshop', soon(5))];

const ownTabs = buildActivityTabs({ going: GOING, saved: SAVED, isOwnProfile: true });
const otherTabs = buildActivityTabs({
  going: GOING,
  saved: [],
  isOwnProfile: false,
  displayName: 'Lara',
});
const emptyTabs = buildActivityTabs({ going: [], saved: [], isOwnProfile: true });

function renderPanel(
  tabs = ownTabs,
  props: Partial<React.ComponentProps<typeof ProfileActivityPanel>> = {},
) {
  const onSelectActivity = jest.fn();
  const onSelectTicket = jest.fn();
  render(
    <ProfileActivityPanel
      tabs={tabs}
      isLoading={false}
      onSelectActivity={onSelectActivity}
      onSelectTicket={onSelectTicket}
      registeredIds={new Set(GOING.map((e) => e.id))}
      {...props}
    />,
  );
  return { onSelectActivity, onSelectTicket };
}

describe('ProfileActivityPanel', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('the segmented control', () => {
    it('shows every category at once with its real count', () => {
      renderPanel();
      expect(screen.getByLabelText('All, 4')).toBeTruthy();
      expect(screen.getByLabelText('Going, 2')).toBeTruthy();
      expect(screen.getByLabelText('Saved, 1')).toBeTruthy();
      expect(screen.getByLabelText('Past, 1')).toBeTruthy();
    });

    it('opens on All — the count the user just tapped on the stat row', () => {
      renderPanel();
      expect(screen.getByLabelText('All, 4')).toHaveProp('accessibilityState', {
        selected: true,
      });
      // All = going ∪ saved ∪ past, so both the saved-only and the finished
      // activity are present.
      expect(screen.getByText('Riso Workshop')).toBeTruthy();
      expect(screen.getByText('Last Winter Show')).toBeTruthy();
    });

    it('swaps the list in place when a category is selected', () => {
      renderPanel();
      fireEvent.press(screen.getByLabelText('Going, 2'));
      expect(screen.getByText('Warehouse Night')).toBeTruthy();
      expect(screen.queryByText('Riso Workshop')).toBeNull();
      expect(screen.queryByText('Last Winter Show')).toBeNull();
    });

    it('keeps Going to upcoming and Past to finished — the stated rule', () => {
      renderPanel();
      fireEvent.press(screen.getByLabelText('Past, 1'));
      expect(screen.getByText('Last Winter Show')).toBeTruthy();
      expect(screen.queryByText('Warehouse Night')).toBeNull();
    });

    it('offers no Saved category on someone else\'s profile', () => {
      renderPanel(otherTabs, { onSelectTicket: undefined });
      expect(screen.queryByLabelText(/^Saved/)).toBeNull();
      expect(screen.getByLabelText(/^All/)).toBeTruthy();
      expect(screen.getByLabelText(/^Going/)).toBeTruthy();
      expect(screen.getByLabelText(/^Past/)).toBeTruthy();
    });
  });

  describe('rows', () => {
    it('hands the tapped activity back so the sheet can close before routing', () => {
      const { onSelectActivity } = renderPanel();
      fireEvent.press(screen.getByText('Warehouse Night'));
      expect(onSelectActivity).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'g1' }),
      );
    });
  });

  describe('the ticket badge — what replaced the Tickets tab', () => {
    it('badges a ticketed row in every category, not just one', () => {
      renderPanel();
      expect(screen.getByLabelText('Show your ticket for Warehouse Night')).toBeTruthy();
      fireEvent.press(screen.getByLabelText('Going, 2'));
      expect(screen.getByLabelText('Show your ticket for Warehouse Night')).toBeTruthy();
    });

    it('leaves free activities unbadged', () => {
      renderPanel();
      expect(screen.queryByLabelText(/ticket for Free Jam/)).toBeNull();
    });

    it('goes to the ticket, NOT the activity — one tap to the QR', () => {
      const { onSelectActivity, onSelectTicket } = renderPanel();
      fireEvent.press(screen.getByLabelText('Show your ticket for Warehouse Night'));
      expect(onSelectTicket).toHaveBeenCalledWith(expect.objectContaining({ id: 'g1' }));
      // The badge sits inside a tappable row; if the row's own handler also
      // fired, the user would be bounced to the event page instead.
      expect(onSelectActivity).not.toHaveBeenCalled();
    });

    it('marks an external-only ticket as external rather than faking a QR', () => {
      const external = makeEvent('x1', 'Club Night', soon(2), {
        ticket_url: 'https://tickets.example/x1',
      });
      renderPanel(buildActivityTabs({ going: [], saved: [external], isOwnProfile: true }), {
        registeredIds: new Set<string>(),
      });
      expect(
        screen.getByLabelText('Open tickets for Club Night — external site'),
      ).toBeTruthy();
    });

    it('draws no badges at all on someone else\'s profile', () => {
      // Their registrations are not tickets you hold.
      renderPanel(otherTabs, { onSelectTicket: undefined });
      expect(screen.queryByLabelText(/ticket for/i)).toBeNull();
    });
  });

  describe('empty states', () => {
    it('gives a considered message rather than a blank list', () => {
      renderPanel(emptyTabs);
      expect(
        screen.getByText('Nothing here yet — activities you join or save land in this list.'),
      ).toBeTruthy();
    });

    it('gives each category its OWN empty message', () => {
      renderPanel(emptyTabs);
      fireEvent.press(screen.getByLabelText('Past, 0'));
      expect(screen.getByText(/move here once they’re over/)).toBeTruthy();
    });

    it('still shows the segmented control when everything is empty', () => {
      renderPanel(emptyTabs);
      expect(screen.getByLabelText('Saved, 0')).toBeTruthy();
    });

    it('does not treat a near-empty Going as an error', () => {
      // 56 activities, 6 upcoming is Aidan's real shape: Going is often thin
      // and must read as normal.
      renderPanel(emptyTabs);
      fireEvent.press(screen.getByLabelText('Going, 0'));
      expect(screen.getByText(/Nothing coming up/)).toBeTruthy();
    });
  });

  it('renders nothing when there are no categories at all', () => {
    renderPanel([]);
    expect(screen.queryByTestId('profile-activity-panel')).toBeNull();
  });

  it('surfaces an error instead of pretending the list is empty', () => {
    renderPanel(emptyTabs, { error: 'Could not load activities' });
    expect(screen.getByText('Could not load activities')).toBeTruthy();
  });
});
