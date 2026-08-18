/**
 * The two buttons in the inbox header.
 *
 * ── The bug ──────────────────────────────────────────────────────────────────
 * Report ce750054: "These buttons do nothing on the messaging page", with the
 * expectation spelled out — "the plus button I am expecting the ability to
 * search and send user messages". Both handlers were `console.log` stubs:
 *
 *     onPress={() => console.log('[Messages] options')}
 *     onPress={() => console.log('[Messages] new conversation')}
 *
 * The report's screenshot is itself a casualty of the annotation bug filed
 * the same day (97398534) — it arrived as two red circles on a blank white
 * page, which is how the header corners were identified.
 *
 * These tests press the real buttons and assert something actually opens. A
 * handler that logs and returns cannot pass them.
 */

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import MessagesScreen from '../index';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

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

jest.mock('expo-image', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactLib = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  return { Image: (props: Record<string, unknown>) => ReactLib.createElement(View, props) };
});

jest.mock('@/context/AuthContext', () => ({
  useAuthContext: () => ({ user: { id: 'user-1' }, session: null, profile: null }),
}));

jest.mock('@/context/AppContext', () => ({
  useAppContext: () => ({ blockedIds: new Set<string>() }),
}));

jest.mock('@/context/MessagesContext', () => ({
  useMessagesContext: () => ({
    conversations: [],
    totalUnread: 0,
    isLoading: false,
    error: null,
    refresh: jest.fn(() => Promise.resolve()),
    markRead: jest.fn(() => Promise.resolve()),
  }),
}));

// The people search behind the `+`. Returns one match so the row can be
// pressed and the navigation asserted.
const mockSearchProfiles = jest.fn(() =>
  Promise.resolve([
    {
      id: 'user-2',
      display_name: 'Lara Ladik',
      username: 'lara',
      avatar_url: null,
    },
  ])
);
jest.mock('@/services/profile.service', () => ({
  searchProfiles: (...args: unknown[]) => mockSearchProfiles(...(args as [])),
}));

// Names match the real module — a mock that invents an export would leave
// the sheet holding `undefined` and still pass, which is not a test.
jest.mock('@/services/moderation.service', () => ({
  listBlockedProfiles: jest.fn(() => Promise.resolve([])),
  unblockUser: jest.fn(() => Promise.resolve()),
}));

async function renderInbox() {
  const utils = render(<MessagesScreen />);
  await act(async () => {});
  return utils;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Messages — the "+" button', () => {
  it('opens a people search instead of logging to the console', async () => {
    const screen = await renderInbox();

    // Nothing open to begin with.
    expect(screen.queryByPlaceholderText('Search people…')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Start new conversation'));
    });

    expect(screen.getByPlaceholderText('Search people…')).toBeTruthy();
  });

  it('searches the profiles table for what you type', async () => {
    const screen = await renderInbox();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Start new conversation'));
    });

    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('Search people…'), 'lara');
    });
    // Past the debounce.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });

    expect(mockSearchProfiles).toHaveBeenCalled();
    expect(screen.getByText('Lara Ladik')).toBeTruthy();
  });

  it('does not search on a single character', async () => {
    // One letter against 42 profiles returns nearly everyone; the round trip
    // is wasted and the list is noise.
    const screen = await renderInbox();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Start new conversation'));
    });
    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('Search people…'), 'l');
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });

    expect(mockSearchProfiles).not.toHaveBeenCalled();
  });

  it('opens the thread with the person you picked', async () => {
    const screen = await renderInbox();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Start new conversation'));
    });
    await act(async () => {
      fireEvent.changeText(screen.getByPlaceholderText('Search people…'), 'lara');
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Message Lara Ladik'));
      // The push is deferred until the sheet has finished dismissing.
      await new Promise((r) => setTimeout(r, 400));
    });

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/messages/user-2');
  });
});

describe('Messages — the "…" button', () => {
  it('opens a menu with a real action on it', async () => {
    const screen = await renderInbox();

    expect(screen.queryByText('Blocked accounts')).toBeNull();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Open options'));
    });

    expect(screen.getByText('Blocked accounts')).toBeTruthy();
  });
});
