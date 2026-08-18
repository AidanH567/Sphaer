import React from 'react';
import { act, render, fireEvent } from '@testing-library/react-native';
import FeedScreen from '../index';
import type { EventWithRelations } from '@/types/event.types';

/**
 * Drives the provenance filter through the real Feed screen: tap the chip,
 * read the cards that survive. A green predicate unit test would not catch a
 * chip wired to the wrong state, a memo missing `origin` from its dependency
 * list, or a filter that never reaches applyChipFilters — all of which are
 * exactly the ways this feature breaks.
 *
 * Everything the screen reaches for outside pure RN rendering is mocked
 * inline (project testing policy: no shared setup files). `useEvents` is
 * stubbed with a fixed mixed set so the assertions are about the FILTER, not
 * about the network.
 */

// --- the fixture: 3 human-posted, 2 aggregated ------------------------------
function makeEvent(over: Partial<EventWithRelations>): EventWithRelations {
  return {
    id: 'evt',
    creator_id: 'user-1',
    circle_id: null,
    title: 'Untitled',
    description: null,
    location_name: 'Somewhere',
    address: null,
    lat: null,
    lng: null,
    starts_at: '2026-09-01T20:00:00',
    ends_at: '2026-09-01T23:00:00',
    categories: [],
    poster_url: null,
    ticket_url: null,
    is_free: false,
    price: null,
    neighbourhood: null,
    borough: null,
    created_at: '2026-08-01T00:00:00',
    creator: null,
    circle: null,
    ...over,
  } as EventWithRelations;
}

const POSTED = [
  makeEvent({ id: 'p1', title: 'Synth Jam at Görli', source: null }),
  makeEvent({ id: 'p2', title: 'Zine Swap', source: null }),
  // A row created before the provenance migration: no `source` key at all.
  makeEvent({ id: 'p3', title: 'Life Drawing' }),
];
const AGGREGATED = [
  makeEvent({
    id: 'a1',
    title: 'Konzert im Privatclub',
    source: 'tina:jsonld',
    source_url: 'https://www.privatclub-berlin.de/events/123',
    location_name: 'Privatclub',
  }),
  makeEvent({
    id: 'a2',
    title: 'Sameheads Late',
    source: 'tina:ics',
    source_url: null,
    location_name: 'Sameheads',
  }),
];
const ALL_EVENTS = [...POSTED, ...AGGREGATED];

const POSTED_TITLES = POSTED.map((e) => e.title);
const AGGREGATED_TITLES = AGGREGATED.map((e) => e.title);

// --- mocks ------------------------------------------------------------------
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  // The screen registers two useFocusEffect callbacks (refetch + saved ids).
  // Run the effect body once on mount, like focus would.
  useFocusEffect: (cb: () => void | (() => void)) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ReactLib = require('react');
    ReactLib.useEffect(cb, [cb]);
  },
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'denied' })),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

// moti ships untranspiled ESM and jest-expo's transformIgnorePatterns doesn't
// cover it, so importing the loading skeleton explodes. Mocked locally rather
// than widening the shared jest config — same treatment as
// MyCirclesSection.test.tsx. MotiView is only the shimmer wrapper.
jest.mock('moti', () => {
  const ReactLib = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    MotiView: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactLib.createElement(View, props, children),
  };
});

jest.mock('expo-image', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactLib = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return { Image: (props: Record<string, unknown>) => ReactLib.createElement(View, props) };
});

// The header carries search / category / neighbourhood / view-toggle — all
// irrelevant here, and it drags in the Places client. Stub it out.
jest.mock('@/components/feed/FeedHeader', () => ({ FeedHeader: () => null }));

jest.mock('@/context/AuthContext', () => ({
  useAuthContext: () => ({ user: { id: 'user-1' }, session: null, profile: null }),
}));

// Real useState so pressing a chip actually re-renders the screen with the
// new filters — a frozen object here would make every assertion pass on the
// unfiltered list and prove nothing.
jest.mock('@/context/AppContext', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactLib = require('react');
  return {
    useAppContext: () => {
      const [feedFilters, setFeedFilters] = ReactLib.useState({});
      const [feedView, setFeedView] = ReactLib.useState('feed');
      return {
        feedView,
        setFeedView,
        feedFilters,
        setFeedFilters,
        userCoords: null,
        setUserCoords: jest.fn(),
        foregroundTick: 0,
        blockedIds: new Set<string>(),
      };
    },
  };
});

jest.mock('@/hooks/useEvents', () => ({
  useEvents: () => ({
    events: mockEventsRef.current,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/services/events.service', () => ({
  getSavedEventIds: jest.fn(() => Promise.resolve([])),
  saveEvent: jest.fn(() => Promise.resolve()),
  unsaveEvent: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/services/profile.service', () => ({
  searchProfiles: jest.fn(() => Promise.resolve([])),
}));

// Declared after the mocks that close over it — `var` so the hoisted
// jest.mock factories can see it at call time.
// eslint-disable-next-line no-var
var mockEventsRef: { current: EventWithRelations[] } = { current: [] };

beforeEach(() => {
  jest.clearAllMocks();
  mockEventsRef.current = ALL_EVENTS;
});

/**
 * Render the feed and settle it. `getSavedEventIds` resolves on the next
 * microtask and writes state; flushing that inside `act` keeps the console
 * free of "update not wrapped in act" noise, which otherwise buries a real
 * failure in this file.
 */
async function renderFeed() {
  const utils = render(<FeedScreen />);
  await act(async () => {});
  return utils;
}

/** Titles currently rendered as cards. */
function visibleTitles(queryByText: (t: string) => unknown): string[] {
  return ALL_EVENTS.map((e) => e.title).filter((t) => queryByText(t) !== null);
}

describe('Feed — "where did this come from" filter', () => {
  it('defaults to All: community and aggregated events share one feed', async () => {
    const { queryByText } = await renderFeed();
    expect(visibleTitles(queryByText)).toEqual(ALL_EVENTS.map((e) => e.title));
  });

  it('offers both states as chips without either being pre-selected', async () => {
    const { getByText } = await renderFeed();
    // Visible without tapping anything — the reason this is two chips and
    // not one chip that cycles through three hidden states.
    expect(getByText('From the community')).toBeTruthy();
    expect(getByText('Found around Berlin')).toBeTruthy();
  });

  it('"From the community" leaves only the events people posted', async () => {
    const { getByText, queryByText } = await renderFeed();
    fireEvent.press(getByText('From the community'));
    expect(visibleTitles(queryByText)).toEqual(POSTED_TITLES);
    for (const title of AGGREGATED_TITLES) expect(queryByText(title)).toBeNull();
  });

  it('"Found around Berlin" leaves only the imported listings', async () => {
    const { getByText, queryByText } = await renderFeed();
    fireEvent.press(getByText('Found around Berlin'));
    expect(visibleTitles(queryByText)).toEqual(AGGREGATED_TITLES);
    for (const title of POSTED_TITLES) expect(queryByText(title)).toBeNull();
  });

  it('the two states are mutually exclusive — picking one drops the other', async () => {
    const { getByText, queryByText } = await renderFeed();
    fireEvent.press(getByText('From the community'));
    expect(visibleTitles(queryByText)).toEqual(POSTED_TITLES);
    fireEvent.press(getByText('Found around Berlin'));
    expect(visibleTitles(queryByText)).toEqual(AGGREGATED_TITLES);
  });

  it('tapping the lit chip again returns to All', async () => {
    const { getByText, queryByText } = await renderFeed();
    fireEvent.press(getByText('Found around Berlin'));
    expect(visibleTitles(queryByText)).toEqual(AGGREGATED_TITLES);
    fireEvent.press(getByText('Found around Berlin'));
    expect(visibleTitles(queryByText)).toEqual(ALL_EVENTS.map((e) => e.title));
  });

  it('an event with no source column at all counts as community', async () => {
    // Every row created before migration 20260817200000 is in this state.
    // Filing them as "found around Berlin" would credit a venue for a
    // person's own event.
    const { getByText, queryByText } = await renderFeed();
    fireEvent.press(getByText('From the community'));
    expect(queryByText('Life Drawing')).toBeTruthy();
  });

  it('narrowing to a state with nothing in it explains how to get back', async () => {
    mockEventsRef.current = POSTED;
    const { getByText, queryByText } = await renderFeed();
    fireEvent.press(getByText('Found around Berlin'));
    expect(queryByText('Nothing found out there')).toBeTruthy();
    expect(queryByText('Try clearing the chips above to see everything.')).toBeTruthy();
    // Not the cold-start "Browse circles" CTA — the feed isn't empty, the
    // filter is.
    expect(queryByText('Browse circles')).toBeNull();
  });

  it('credits an aggregated listing on the card, and only there', async () => {
    const { queryByText } = await renderFeed();
    // Read off a real page → credit the host it came from.
    expect(queryByText('via privatclub-berlin.de')).toBeTruthy();
    // No source_url → fall back to the venue rather than printing nothing.
    expect(queryByText('via Sameheads')).toBeTruthy();
    // A person's own event carries no credit line.
    expect(queryByText('via Somewhere')).toBeNull();
  });
});
