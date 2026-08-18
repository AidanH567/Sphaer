import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PinnedEventsSection } from '@/components/messaging/PinnedEventsSection';
import { getCircleUpcomingEvents } from '@/services/events.service';
import { dayKey } from '@/utils/pinned-events';
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

// Icon's async font load fires a setState outside act — same mock as
// EventCard.test.tsx / UserEventsSheet.test.tsx.
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

// Keeps the Supabase client out of the test environment; the hook only needs
// this one fetcher.
jest.mock('@/services/events.service', () => ({
  getCircleUpcomingEvents: jest.fn(),
}));

const fetchMock = getCircleUpcomingEvents as jest.MockedFunction<typeof getCircleUpcomingEvents>;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Events are built relative to the real clock — the component reads
 *  `new Date()` for its "Today / Tomorrow" label, so anchoring to now keeps
 *  the assertions true whenever the suite runs. */
function makeEvent(
  id: string,
  startsInMs: number,
  overrides: Partial<EventWithRelations> = {}
): EventWithRelations {
  const starts = new Date(Date.now() + startsInMs);
  return {
    id,
    creator_id: 'user-1',
    circle_id: 'circle-1',
    title: `Event ${id}`,
    description: null,
    location_name: 'Sisyphos',
    address: null,
    lat: null,
    lng: null,
    starts_at: starts.toISOString(),
    ends_at: new Date(starts.getTime() + 3 * HOUR).toISOString(),
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

/**
 * Titles of the currently-rendered pinned rows, in render order.
 *
 * Matched on the row's accessibility label ("Event a, 17 Aug, 20:00-23:00")
 * rather than its title text, because the collapsed summary line also
 * contains the next event's title and would otherwise be counted as a row.
 */
function rowTitles(): string[] {
  return screen
    .queryAllByLabelText(/^Event .+, \d+ \w{3}, /)
    .map((node) => String(node.props.accessibilityLabel).split(',')[0]);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PinnedEventsSection — empty state', () => {
  it('renders one quiet line naming the circle, and no calendar strip', async () => {
    fetchMock.mockResolvedValue([]);

    render(<PinnedEventsSection circleId="circle-1" circleName="Sphaer Crew" />);

    expect(await screen.findByText('Nothing coming up in Sphaer Crew yet.')).toBeTruthy();
    // No summary bar, no count pill, nothing tappable to expand.
    expect(screen.queryByText('Upcoming')).toBeNull();
  });

  it('falls back to "this circle" when the name has not loaded yet', async () => {
    fetchMock.mockResolvedValue([]);

    render(<PinnedEventsSection circleId="circle-1" circleName={null} />);

    expect(await screen.findByText('Nothing coming up in this circle yet.')).toBeTruthy();
  });

  it('treats a circle whose only events have finished as empty', async () => {
    fetchMock.mockResolvedValue([
      makeEvent('past', -2 * DAY, {
        ends_at: new Date(Date.now() - 2 * DAY + HOUR).toISOString(),
      }),
    ]);

    render(<PinnedEventsSection circleId="circle-1" circleName="Sphaer Crew" />);

    expect(await screen.findByText('Nothing coming up in Sphaer Crew yet.')).toBeTruthy();
  });

  it('renders nothing at all while the first fetch is in flight', () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    const { toJSON } = render(<PinnedEventsSection circleId="circle-1" circleName="Sphaer Crew" />);

    expect(toJSON()).toBeNull();
  });
});

describe('PinnedEventsSection — populated', () => {
  it('collapses to a summary naming the soonest event and the total count', async () => {
    fetchMock.mockResolvedValue([
      makeEvent('b', 5 * DAY),
      makeEvent('a', 2 * HOUR),
      makeEvent('c', 9 * DAY),
    ]);

    render(<PinnedEventsSection circleId="circle-1" circleName="Sphaer Crew" />);

    expect(await screen.findByText('Upcoming')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    // Soonest first — "Event a" wins even though it was returned second.
    expect(screen.getByText('Event a · Today')).toBeTruthy();
    // Collapsed: the rows are not mounted.
    expect(screen.queryByText('Event b')).toBeNull();
  });

  it('lists events soonest-first once expanded', async () => {
    fetchMock.mockResolvedValue([
      makeEvent('later', 5 * DAY),
      makeEvent('soon', 2 * HOUR),
      makeEvent('middle', 2 * DAY),
    ]);

    render(<PinnedEventsSection circleId="circle-1" circleName="Sphaer Crew" />);
    fireEvent.press(await screen.findByText('Upcoming'));

    expect(rowTitles()).toEqual(['Event soon', 'Event middle', 'Event later']);
  });

  it('caps the list at four rows and offers the rest on the circle page', async () => {
    fetchMock.mockResolvedValue([
      makeEvent('e1', 1 * DAY),
      makeEvent('e2', 2 * DAY),
      makeEvent('e3', 3 * DAY),
      makeEvent('e4', 4 * DAY),
      makeEvent('e5', 5 * DAY),
      makeEvent('e6', 6 * DAY),
    ]);

    render(<PinnedEventsSection circleId="circle-1" circleName="Sphaer Crew" />);
    fireEvent.press(await screen.findByText('Upcoming'));

    expect(rowTitles()).toEqual(['Event e1', 'Event e2', 'Event e3', 'Event e4']);
    expect(screen.getByText('2 more in this circle')).toBeTruthy();
  });

  it('routes to the event detail page when a row is tapped', async () => {
    fetchMock.mockResolvedValue([makeEvent('a', 2 * HOUR)]);

    render(<PinnedEventsSection circleId="circle-1" circleName="Sphaer Crew" />);
    fireEvent.press(await screen.findByText('Upcoming'));
    fireEvent.press(screen.getByText('Event a'));

    expect(mockPush).toHaveBeenCalledWith('/event/a');
  });
});

describe('PinnedEventsSection — mini-calendar filtering', () => {
  it('narrows the list to the tapped day, then restores it on a second tap', async () => {
    const inTwoDays = 2 * DAY;
    const inFiveDays = 5 * DAY;
    fetchMock.mockResolvedValue([
      makeEvent('near', inTwoDays),
      makeEvent('far', inFiveDays),
    ]);

    render(<PinnedEventsSection circleId="circle-1" circleName="Sphaer Crew" />);
    fireEvent.press(await screen.findByText('Upcoming'));
    expect(rowTitles()).toEqual(['Event near', 'Event far']);

    const targetDay = new Date(Date.now() + inTwoDays);
    const cell = screen.getByLabelText(
      `${targetDay.toLocaleDateString('en-GB', { weekday: 'short' })} ${targetDay.getDate()}, 1 event`
    );

    fireEvent.press(cell);
    expect(rowTitles()).toEqual(['Event near']);

    fireEvent.press(cell);
    expect(rowTitles()).toEqual(['Event near', 'Event far']);
  });

  it('marks a day with two events as such and leaves bare days untappable', async () => {
    // Anchored to a FIXED HOUR of a future day, not to a raw offset from now.
    // The old fixture used `3 * DAY + HOUR` and `3 * DAY + 5 * HOUR` and then
    // asked for the day label of `now + 3 * DAY`. `dayKey` is a LOCAL CALENDAR
    // day, so from 19:00 local onwards the +5h event rolls past midnight onto
    // the following day and the cell reads "1 event" (and from 23:00, "0").
    // Measured across all 24 hours: the assertion is false between 19:00 and
    // 23:59 every single day. Two agents lost time reading it as a regression
    // in the pinned-events feature, which it never was.
    const busy = new Date();
    busy.setDate(busy.getDate() + 3);
    busy.setHours(10, 0, 0, 0);
    const toBusyDay = busy.getTime() - Date.now();

    fetchMock.mockResolvedValue([
      makeEvent('one', toBusyDay),
      makeEvent('two', toBusyDay + 4 * HOUR),
    ]);

    render(<PinnedEventsSection circleId="circle-1" circleName="Sphaer Crew" />);
    fireEvent.press(await screen.findByText('Upcoming'));

    const busyLabel = `${busy.toLocaleDateString('en-GB', { weekday: 'short' })} ${busy.getDate()}, 2 events`;
    expect(screen.getByLabelText(busyLabel)).toBeTruthy();

    // A day with nothing on it still appears in the strip (so the shape of
    // the fortnight reads) but announces itself as empty and is disabled.
    const quiet = new Date(Date.now() + 7 * DAY);
    const quietCell = screen.getByLabelText(
      `${quiet.toLocaleDateString('en-GB', { weekday: 'short' })} ${quiet.getDate()}, nothing on`
    );
    expect(quietCell.props.accessibilityState.disabled).toBe(true);
  });

  it('covers exactly two weeks of day cells', async () => {
    fetchMock.mockResolvedValue([makeEvent('a', 2 * HOUR)]);

    render(<PinnedEventsSection circleId="circle-1" circleName="Sphaer Crew" />);
    fireEvent.press(await screen.findByText('Upcoming'));

    const strip = screen.getByLabelText('Upcoming two weeks');
    // ScrollView children live under a contentContainer wrapper.
    const cellLabels = screen
      .getAllByRole('button')
      .filter((n) => /, (\d+ events?|nothing on)$/.test(String(n.props.accessibilityLabel)));
    expect(strip).toBeTruthy();
    expect(cellLabels).toHaveLength(14);
  });

  it('marks the filtered day as selected and keeps the count pill on the total', async () => {
    // The pill answers "how much is coming up in this circle" — filtering the
    // list to one day must not make it read as though the rest vanished.
    fetchMock.mockResolvedValue([makeEvent('near', 2 * DAY), makeEvent('far', 5 * DAY)]);

    render(<PinnedEventsSection circleId="circle-1" circleName="Sphaer Crew" />);
    fireEvent.press(await screen.findByText('Upcoming'));

    const target = new Date(Date.now() + 2 * DAY);
    const label = `${target.toLocaleDateString('en-GB', { weekday: 'short' })} ${target.getDate()}, 1 event`;
    fireEvent.press(screen.getByLabelText(label));

    expect(rowTitles()).toEqual(['Event near']);
    expect(screen.getByLabelText(label).props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('2')).toBeTruthy();
    expect(dayKey(target)).toBe(dayKey(new Date(Date.now() + 2 * DAY)));
  });
});

describe('PinnedEventsSection — failure', () => {
  it('offers a retry line instead of a blank space when the fetch fails', async () => {
    // The hook dev-logs the rejection on purpose; keep it out of the report.
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    render(<PinnedEventsSection circleId="circle-1" circleName="Sphaer Crew" />);

    const retry = await screen.findByText("Couldn't load upcoming events. Tap to retry.");
    expect(retry).toBeTruthy();

    fetchMock.mockResolvedValue([makeEvent('a', 2 * HOUR)]);
    fireEvent.press(retry);

    await waitFor(() => expect(screen.getByText('Upcoming')).toBeTruthy());
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it('renders the empty line rather than crashing when there is no circle id', async () => {
    render(<PinnedEventsSection circleId={undefined} circleName="Sphaer Crew" />);

    expect(await screen.findByText('Nothing coming up in Sphaer Crew yet.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
