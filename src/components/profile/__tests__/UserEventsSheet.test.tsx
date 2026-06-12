import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import {
  UserEventsSheet,
  mergeUserActivities,
  loadUserActivities,
} from '@/components/profile/UserEventsSheet';
import { getEventsByCreator } from '@/services/events.service';
import { getMyRegisteredEvents } from '@/services/registrations.service';
import { formatEventDateShort } from '@/utils/date';
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

// Icon's internal async font load fires a setState outside act — mock it
// away (same approach as EventCard.test.tsx).
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

// Same shape as overflow-report-flow.test.tsx — the sheet reads insets.
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
  };
});

// Keep the Supabase client out of the test environment — loadUserActivities
// only needs the two fetchers, mocked per test.
jest.mock('@/services/events.service', () => ({
  getEventsByCreator: jest.fn(),
}));
jest.mock('@/services/registrations.service', () => ({
  getMyRegisteredEvents: jest.fn(),
}));

const HOUR = 60 * 60 * 1000;

function makeEvent(
  id: string,
  startsAt: string,
  overrides: Partial<EventWithRelations> = {}
): EventWithRelations {
  return {
    id,
    creator_id: 'user-1',
    circle_id: null,
    title: `Event ${id}`,
    description: null,
    location_name: 'Görlitzer Park',
    address: null,
    lat: null,
    lng: null,
    starts_at: startsAt,
    ends_at: null,
    categories: ['Music'],
    poster_url: null,
    ticket_url: null,
    is_free: true,
    price: null,
    neighbourhood: null,
    borough: null,
    created_at: '2026-06-01T00:00:00',
    creator: null,
    circle: null,
    ...overrides,
  } as EventWithRelations;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('mergeUserActivities', () => {
  it('dedups events that appear in both created and registered lists', () => {
    const shared = makeEvent('evt-shared', new Date(Date.now() + HOUR).toISOString());
    const createdOnly = makeEvent('evt-created', new Date(Date.now() + 2 * HOUR).toISOString());
    const registeredOnly = makeEvent('evt-reg', new Date(Date.now() + 3 * HOUR).toISOString());

    const merged = mergeUserActivities([shared, createdOnly], [shared, registeredOnly]);

    expect(merged.map((e) => e.id).sort()).toEqual(['evt-created', 'evt-reg', 'evt-shared']);
  });

  it('orders upcoming soonest-first, then past most-recent-first', () => {
    const now = Date.now();
    const soon = makeEvent('soon', new Date(now + HOUR).toISOString());
    const later = makeEvent('later', new Date(now + 5 * HOUR).toISOString());
    const yesterday = makeEvent('yesterday', new Date(now - 24 * HOUR).toISOString());
    const lastWeek = makeEvent('last-week', new Date(now - 7 * 24 * HOUR).toISOString());

    const merged = mergeUserActivities([later, lastWeek], [yesterday, soon]);

    expect(merged.map((e) => e.id)).toEqual(['soon', 'later', 'yesterday', 'last-week']);
  });
});

describe('loadUserActivities', () => {
  it('merges both sources for a user', async () => {
    const created = makeEvent('evt-c', new Date(Date.now() + HOUR).toISOString());
    const registered = makeEvent('evt-r', new Date(Date.now() + 2 * HOUR).toISOString());
    jest.mocked(getEventsByCreator).mockResolvedValueOnce([created]);
    jest.mocked(getMyRegisteredEvents).mockResolvedValueOnce([registered]);

    const result = await loadUserActivities('user-1');

    expect(getEventsByCreator).toHaveBeenCalledWith('user-1');
    expect(getMyRegisteredEvents).toHaveBeenCalledWith('user-1');
    expect(result.map((e) => e.id)).toEqual(['evt-c', 'evt-r']);
  });

  it('degrades to created-only when the registrations query fails', async () => {
    const created = makeEvent('evt-c', new Date(Date.now() + HOUR).toISOString());
    jest.mocked(getEventsByCreator).mockResolvedValueOnce([created]);
    jest.mocked(getMyRegisteredEvents).mockRejectedValueOnce(new Error('rls'));

    const result = await loadUserActivities('user-2');

    expect(result.map((e) => e.id)).toEqual(['evt-c']);
  });
});

describe('UserEventsSheet', () => {
  it('renders a compact row per event with the short date line', () => {
    const event = makeEvent('evt-1', new Date(Date.now() + HOUR).toISOString(), {
      title: 'Synth Jam at Görli',
    });
    render(
      <UserEventsSheet
        visible
        subtitle="1 total — created or registered"
        events={[event]}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText('Activities')).toBeTruthy();
    expect(screen.getByText('1 total — created or registered')).toBeTruthy();
    expect(screen.getByText('Synth Jam at Görli')).toBeTruthy();
    expect(screen.getByText(formatEventDateShort(event.starts_at))).toBeTruthy();
  });

  it('shows the empty state when there are no events', () => {
    render(<UserEventsSheet visible events={[]} onClose={jest.fn()} />);

    expect(screen.getByText('No activities yet')).toBeTruthy();
  });

  it('closes first, then routes to /event/{id} 300ms later on row tap', () => {
    const onClose = jest.fn();
    const event = makeEvent('evt-1', new Date(Date.now() + HOUR).toISOString(), {
      title: 'Synth Jam at Görli',
    });
    render(<UserEventsSheet visible events={[event]} onClose={onClose} />);

    fireEvent.press(screen.getByText('Synth Jam at Görli'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/event/evt-1');
  });

  it('stays mounted when a reopen interrupts the close animation', () => {
    const event = makeEvent('evt-1', new Date(Date.now() + HOUR).toISOString());
    const { rerender } = render(
      <UserEventsSheet visible events={[event]} onClose={jest.fn()} />
    );
    expect(screen.getByText('Event evt-1')).toBeTruthy();

    // Close, then reopen before the close animation completes — the
    // finished:false guard must keep the Modal mounted (same regression the
    // OverflowMenuSheet fix covers).
    rerender(<UserEventsSheet visible={false} events={[event]} onClose={jest.fn()} />);
    act(() => {
      jest.advanceTimersByTime(100);
    });
    rerender(<UserEventsSheet visible events={[event]} onClose={jest.fn()} />);
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(screen.getByText('Event evt-1')).toBeTruthy();
  });
});
