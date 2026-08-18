import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react-native';
import { PinnedEventsSection } from '@/components/messaging/PinnedEventsSection';
import { getCircleUpcomingEvents } from '@/services/events.service';
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

/**
 * A local Date at `hour` o'clock on the calendar day `dayOffset` days from
 * today. Every fixture in this file is built with it.
 *
 * Fixtures are anchored to CALENDAR DAYS, never to millisecond offsets from
 * `Date.now()`. The section buckets events by local calendar day (`dayKey`)
 * and labels the soonest one relative to today, so a fixture written as
 * `Date.now() + 5 * HOUR` lands on a different day depending on the hour the
 * suite happens to run at. That is not a hypothetical: `now + 5 * HOUR`
 * crossed midnight and broke the two-events-on-a-day assertion every evening
 * from 19:00, and `now + 2 * HOUR` broke the summary assertion every evening
 * from 22:00. Both were read as feature regressions before anyone noticed the
 * clock. There is no offset that fixes the class — near midnight there is no
 * "later today" for an offset to point at.
 *
 * The Date(y, m, d, h) constructor is also the DST-safe arithmetic
 * `addDays`/`buildCalendarDays` use, so `dayAt(n, h)` is exactly `n` cells
 * along the strip even across a clock change. `Date.now() + n * 86_400_000`
 * is off by one cell on the two nights a year Berlin's offset moves.
 */
function dayAt(dayOffset: number, hour: number): Date {
  const base = new Date();
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, hour, 0, 0, 0);
}

function makeEvent(
  id: string,
  starts: Date,
  overrides: Partial<EventWithRelations> = {}
): EventWithRelations {
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
 * Tonight's party: opens today at 19:00, runs until 04:00 tomorrow.
 *
 * The one fixture that must read "Today", and it reads "Today" at all 24
 * hours. It starts on today's calendar day, so `relativeDayLabel` says
 * "Today" whether the suite runs at 02:00 or 23:59; and its `ends_at` is
 * tomorrow morning, so `selectUpcoming` keeps it after 19:00 when it is
 * already running rather than dropping it and changing the count.
 *
 * That "still running" path is the documented behaviour of `relevantUntil` —
 * "a party that started an hour ago and runs until 04:00 stays pinned" — so
 * the fixture exercises real behaviour rather than dodging the clock.
 */
function tonight(id: string): EventWithRelations {
  return makeEvent(id, dayAt(0, 19), { ends_at: dayAt(1, 4).toISOString() });
}

/** The mini-calendar cell label the strip renders for a given local day. */
function cellLabel(day: Date, tail: string): string {
  return `${day.toLocaleDateString('en-GB', { weekday: 'short' })} ${day.getDate()}, ${tail}`;
}

/**
 * Titles of the currently-rendered pinned rows, in render order.
 *
 * Matched on the row's accessibility label ("Event a, 17 Aug, 20:00-23:00")
 * rather than its title text, because the collapsed summary line also
 * contains the next event's title and would otherwise be counted as a row.
 *
 * The month is `\w+`, not `\w{3}`: en-GB abbreviates September as "Sept",
 * four letters. With `\w{3}` this matcher silently returned [] for every
 * fixture landing in September, which would have emptied four of these tests
 * from around 26 August — a second clock-shaped failure hiding behind the
 * first, and one that looks exactly like "the list stopped rendering".
 */
function rowTitles(): string[] {
  return screen
    .queryAllByLabelText(/^Event .+, \d+ \w+, /)
    .map((node) => String(node.props.accessibilityLabel).split(',')[0]);
}

/**
 * The count pill, scoped to the summary row.
 *
 * `getByText('2')` is not safe once the section is expanded: the strip
 * renders a day-of-month in every cell, so any fortnight containing the 2nd
 * of a month — roughly half the year — has a second element reading "2" and
 * the query throws "found multiple elements". Scoping to the summary row is
 * what the assertion always meant.
 */
function countPillText(): string {
  const summary = screen.getByLabelText(/upcoming events?\. Next: /);
  return String(within(summary).getByText(/^\d+$/).props.children);
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
      makeEvent('past', dayAt(-2, 20), { ends_at: dayAt(-2, 23).toISOString() }),
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
      makeEvent('b', dayAt(5, 19)),
      tonight('a'),
      makeEvent('c', dayAt(9, 19)),
    ]);

    render(<PinnedEventsSection circleId="circle-1" circleName="Sphaer Crew" />);

    expect(await screen.findByText('Upcoming')).toBeTruthy();
    expect(countPillText()).toBe('3');
    // Soonest first — "Event a" wins even though it was returned second — and
    // it carries a day label. The Today/Tomorrow/short-date RULE is proved
    // instant by instant in utils/__tests__/pinned-events.test.ts, including
    // at 23:59 and 00:01; what belongs here is that the section names the
    // right event and dates it.
    expect(screen.getByText('Event a · Today')).toBeTruthy();
    // Collapsed: the rows are not mounted.
    expect(screen.queryByText('Event b')).toBeNull();
  });

  it('dates a soonest event further out by its weekday rather than "Today"', async () => {
    const soonest = dayAt(4, 19);
    fetchMock.mockResolvedValue([makeEvent('b', dayAt(6, 19)), makeEvent('a', soonest)]);

    render(<PinnedEventsSection circleId="circle-1" circleName="Sphaer Crew" />);

    // Built from the fixture's own date, not from relativeDayLabel — the
    // assertion has to be able to disagree with the rule it is checking.
    const expected = soonest.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
    expect(await screen.findByText(`Event a · ${expected}`)).toBeTruthy();
  });

  it('lists events soonest-first once expanded', async () => {
    fetchMock.mockResolvedValue([
      makeEvent('later', dayAt(5, 19)),
      tonight('soon'),
      makeEvent('middle', dayAt(2, 19)),
    ]);

    render(<PinnedEventsSection circleId="circle-1" circleName="Sphaer Crew" />);
    fireEvent.press(await screen.findByText('Upcoming'));

    expect(rowTitles()).toEqual(['Event soon', 'Event middle', 'Event later']);
  });

  it('caps the list at four rows and offers the rest on the circle page', async () => {
    fetchMock.mockResolvedValue([
      makeEvent('e1', dayAt(1, 19)),
      makeEvent('e2', dayAt(2, 19)),
      makeEvent('e3', dayAt(3, 19)),
      makeEvent('e4', dayAt(4, 19)),
      makeEvent('e5', dayAt(5, 19)),
      makeEvent('e6', dayAt(6, 19)),
    ]);

    render(<PinnedEventsSection circleId="circle-1" circleName="Sphaer Crew" />);
    fireEvent.press(await screen.findByText('Upcoming'));

    expect(rowTitles()).toEqual(['Event e1', 'Event e2', 'Event e3', 'Event e4']);
    expect(screen.getByText('2 more in this circle')).toBeTruthy();
  });

  it('routes to the event detail page when a row is tapped', async () => {
    fetchMock.mockResolvedValue([makeEvent('a', dayAt(1, 19))]);

    render(<PinnedEventsSection circleId="circle-1" circleName="Sphaer Crew" />);
    fireEvent.press(await screen.findByText('Upcoming'));
    fireEvent.press(screen.getByText('Event a'));

    expect(mockPush).toHaveBeenCalledWith('/event/a');
  });
});

describe('PinnedEventsSection — mini-calendar filtering', () => {
  it('narrows the list to the tapped day, then restores it on a second tap', async () => {
    const nearDay = dayAt(2, 19);
    fetchMock.mockResolvedValue([
      makeEvent('near', nearDay),
      makeEvent('far', dayAt(5, 19)),
    ]);

    render(<PinnedEventsSection circleId="circle-1" circleName="Sphaer Crew" />);
    fireEvent.press(await screen.findByText('Upcoming'));
    expect(rowTitles()).toEqual(['Event near', 'Event far']);

    const cell = screen.getByLabelText(cellLabel(nearDay, '1 event'));

    fireEvent.press(cell);
    expect(rowTitles()).toEqual(['Event near']);

    fireEvent.press(cell);
    expect(rowTitles()).toEqual(['Event near', 'Event far']);
  });

  it('marks a day with two events as such and leaves bare days untappable', async () => {
    const busy = dayAt(3, 10);
    fetchMock.mockResolvedValue([
      makeEvent('one', busy),
      makeEvent('two', dayAt(3, 14)),
    ]);

    render(<PinnedEventsSection circleId="circle-1" circleName="Sphaer Crew" />);
    fireEvent.press(await screen.findByText('Upcoming'));

    expect(screen.getByLabelText(cellLabel(busy, '2 events'))).toBeTruthy();

    // A day with nothing on it still appears in the strip (so the shape of
    // the fortnight reads) but announces itself as empty and is disabled.
    const quietCell = screen.getByLabelText(cellLabel(dayAt(7, 12), 'nothing on'));
    expect(quietCell.props.accessibilityState.disabled).toBe(true);
  });

  it('covers exactly two weeks of day cells', async () => {
    fetchMock.mockResolvedValue([makeEvent('a', dayAt(1, 19))]);

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
    const nearDay = dayAt(2, 19);
    const farDay = dayAt(5, 19);
    fetchMock.mockResolvedValue([makeEvent('near', nearDay), makeEvent('far', farDay)]);

    render(<PinnedEventsSection circleId="circle-1" circleName="Sphaer Crew" />);
    fireEvent.press(await screen.findByText('Upcoming'));

    fireEvent.press(screen.getByLabelText(cellLabel(nearDay, '1 event')));

    expect(rowTitles()).toEqual(['Event near']);
    expect(screen.getByLabelText(cellLabel(nearDay, '1 event')).props.accessibilityState.selected)
      .toBe(true);
    // Selection is single: the other marked day must not stay lit.
    expect(screen.getByLabelText(cellLabel(farDay, '1 event')).props.accessibilityState.selected)
      .toBe(false);
    expect(countPillText()).toBe('2');
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

    fetchMock.mockResolvedValue([makeEvent('a', dayAt(1, 19))]);
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
