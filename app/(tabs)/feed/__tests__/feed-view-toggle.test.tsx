/**
 * Which view does the Feed screen say you are looking at?
 *
 * ── The bug ──────────────────────────────────────────────────────────────────
 * Report fdaa344a: "we are on the activity page but it says we are on the
 * mural screen". Going Mural → Profile → back to the Feed tab landed on the
 * event list with the Mural pill still highlighted.
 *
 * The cause was that this screen alone derived its active view from mutable
 * app-wide state (`feedView` in AppContext) instead of from the fact that it
 * IS the list view. Returning to the tab re-mounted the stack's initial route
 * while the context still carried the last view visited, and the two
 * disagreed. `map.tsx` and `mural.tsx` always passed their own literal and
 * were never affected.
 *
 * ── Why this file exists separately from feed-source-filter.test.tsx ─────────
 * That suite stubs `FeedHeader` to `() => null` — sensibly, since it is
 * testing card filtering and the header drags in the Places client. But that
 * stub means it renders no toggle at all, so it could not have caught this and
 * cannot guard it. Here the real FeedHeader and ViewToggle render, and only
 * the leaves below them are mocked.
 *
 * The AppContext mock deliberately reports 'mural' on every render. The whole
 * point is that it changes nothing.
 */

import React from 'react';
import { act, render } from '@testing-library/react-native';
import FeedScreen from '../index';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
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

// SearchFilterBar reads the insets to pad the header under the notch.
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
  };
});

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

// The header itself is the thing under test, so it is NOT stubbed. Its
// address-autocomplete leaf reaches for the Places client, which is.
jest.mock('@/lib/places', () => ({
  fetchPlacePredictions: jest.fn(() => Promise.resolve([])),
  fetchPlaceDetails: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuthContext: () => ({ user: { id: 'user-1' }, session: null, profile: null }),
}));

// Reports 'mural' forever — the stale value that used to drive the toggle.
jest.mock('@/context/AppContext', () => ({
  useAppContext: () => ({
    feedView: 'mural',
    setFeedView: jest.fn(),
    feedFilters: {},
    setFeedFilters: jest.fn(),
    userCoords: null,
    setUserCoords: jest.fn(),
    foregroundTick: 0,
    blockedIds: new Set<string>(),
  }),
}));

jest.mock('@/hooks/useEvents', () => ({
  useEvents: () => ({ events: [], isLoading: false, error: null, refetch: jest.fn() }),
}));

jest.mock('@/services/events.service', () => ({
  getSavedEventIds: jest.fn(() => Promise.resolve([])),
  saveEvent: jest.fn(() => Promise.resolve()),
  unsaveEvent: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/services/profile.service', () => ({
  searchProfiles: jest.fn(() => Promise.resolve([])),
}));

async function renderFeed() {
  const utils = render(<FeedScreen />);
  await act(async () => {});
  return utils;
}

/** The ViewToggle pills — each declares `accessibilityRole="tab"`. */
function selectedTabLabels(
  root: ReturnType<typeof render>
): string[] {
  return root
    .getAllByRole('tab')
    .filter((node) => {
      const state = node.props.accessibilityState as { selected?: boolean } | undefined;
      return state?.selected === true;
    })
    .map((node) => {
      // The label is the pill's Text child.
      const texts: { props: { children?: unknown } }[] = node.findAllByType(
        'Text' as never
      );
      return texts.map((t) => String(t.props.children)).join('');
    });
}

describe('Feed — the view toggle reports the screen you are on', () => {
  it('renders all three views as tabs', async () => {
    const screen = await renderFeed();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('selects Feed even when app state still says "mural"', async () => {
    // The exact condition from the report: context carries the previously
    // visited view, this screen is the list. Before the fix this returned
    // ['Mural'].
    const screen = await renderFeed();
    expect(selectedTabLabels(screen)).toEqual(['Feed']);
  });

  it('never marks two views selected at once', async () => {
    const screen = await renderFeed();
    expect(selectedTabLabels(screen)).toHaveLength(1);
  });
});

/**
 * Report c57579ab: "Correct UX writing on Home Screen: Berlin, what's on
 * today? (Grammatically correct, replace old version)".
 *
 * The Figma frame said "Berlin what's on Today?!" and the header copied it
 * exactly — missing comma, capitalised mid-sentence "Today", and "?!" on a
 * plain question.
 */
describe('Feed — the home greeting', () => {
  /** Every Text in the tree, flattened to plain strings. */
  function allText(screen: ReturnType<typeof render>): string[] {
    return screen.UNSAFE_root
      .findAllByType('Text' as never)
      .map((node: { props: { children?: unknown } }) => {
        const flatten = (child: unknown): string => {
          if (typeof child === 'string') return child;
          if (typeof child === 'number') return String(child);
          if (Array.isArray(child)) return child.map(flatten).join('');
          if (child && typeof child === 'object' && 'props' in child) {
            return flatten((child as { props: { children?: unknown } }).props.children);
          }
          return '';
        };
        return flatten(node.props.children);
      });
  }

  it('reads "Berlin, what’s on today?"', async () => {
    const screen = await renderFeed();
    expect(allText(screen)).toContain('Berlin, what’s on today?');
  });

  it('no longer carries the ungrammatical Figma copy', async () => {
    const screen = await renderFeed();
    const texts = allText(screen);
    // The three separate defects, each asserted so a partial revert is caught.
    expect(texts.some((t) => t.includes('what’s on Today'))).toBe(false);
    expect(texts.some((t) => t.includes('?!'))).toBe(false);
    expect(texts.some((t) => /Berlin what/.test(t))).toBe(false);
  });
});
