/**
 * Nobody gets a face they didn't choose.
 *
 * ── The bug (Lara's list, item 8) ────────────────────────────────────────────
 * *"new users who sign up receive an AI generated profile picture in the chat,
 * if they don't upload one. please fix this. they shouldn't get any profile
 * picture if they don't choose to."*
 *
 * Not AI, and not the database — the inbox mapper invented it, client-side, at
 * render time:
 *
 *     avatar: partner.avatar_url ?? `https://i.pravatar.cc/150?u=${partner.id}`
 *
 * `i.pravatar.cc` serves photographs of real human faces, chosen
 * deterministically from `?u=`. Keyed off the user's UUID it is stable, so an
 * avatar-less user got the same convincing photo of a stranger every time —
 * indistinguishable from a picture they had set themselves. Two sibling lines
 * did the same to events and circles via `picsum.photos`.
 *
 * The signup path is clean: `profiles.avatar_url` has no DEFAULT and
 * `handle_new_user` only copies an avatar when an OAuth provider supplied one.
 * Nothing was ever written to the database — which is why it only showed in the
 * inbox list, while the conversation screen one tap deeper (which uses the
 * shared `Avatar`) correctly showed initials for the very same person.
 *
 * These tests assert the rendered inbox contains no fabricated image URL at
 * all. Against the old code they fail on the pravatar/picsum URLs.
 */

import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import MessagesScreen from '../index';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true }),
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

// Spread the props onto a View so `source={{ uri }}` lands in the rendered
// tree — that is what the assertions below inspect.
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

// One of each row kind, every image field empty — the exact shape that used to
// trigger a fabricated picture.
const mockConversations = [
  {
    kind: 'dm',
    partner: {
      id: 'partner-1',
      display_name: 'Lara Ladik',
      username: 'lara',
      avatar_url: null,
    },
    last_message: { id: 'm1', content: 'hey', sender_id: 'partner-1', created_at: null },
    unread_count: 0,
  },
  {
    kind: 'circle',
    circle: { id: 'circle-1', name: 'Neukoelln Ceramics', avatar_url: null },
    last_message: null,
    unread_count: 0,
  },
  {
    kind: 'event',
    event: { id: 'event-1', title: 'Full Moon Session', poster_url: null },
    last_message: null,
    unread_count: 0,
  },
];

jest.mock('@/context/MessagesContext', () => ({
  useMessagesContext: () => ({
    conversations: mockConversations,
    totalUnread: 0,
    isLoading: false,
    error: null,
    refresh: jest.fn(() => Promise.resolve()),
    markRead: jest.fn(() => Promise.resolve()),
  }),
}));

jest.mock('@/services/profile.service', () => ({
  searchProfiles: jest.fn(() => Promise.resolve([])),
}));

jest.mock('@/services/moderation.service', () => ({
  listBlockedProfiles: jest.fn(() => Promise.resolve([])),
  unblockUser: jest.fn(() => Promise.resolve()),
}));

async function renderInbox() {
  const utils = render(<MessagesScreen />);
  await act(async () => {});
  return utils;
}

/**
 * Every image URI the rendered inbox actually asks for.
 *
 * Typed locally: `react-test-renderer` ships no declarations, so annotating
 * the predicate with its `ReactTestInstance` would need a new @types dep.
 */
type TestNode = { props: { source?: { uri?: unknown } } };

function renderedImageUris(): string[] {
  const root = screen.UNSAFE_root as unknown as {
    findAll: (predicate: (node: TestNode) => boolean) => TestNode[];
  };
  return root
    .findAll((node) => typeof node.props?.source?.uri === 'string')
    .map((node) => String((node.props.source as { uri: string }).uri));
}

describe('Inbox avatars — a missing picture stays missing', () => {
  it('never fabricates a human face for a user who uploaded nothing', async () => {
    await renderInbox();

    expect(renderedImageUris().join(' ')).not.toContain('pravatar');
  });

  it('never fabricates a photo for a circle or event without one', async () => {
    await renderInbox();

    expect(renderedImageUris().join(' ')).not.toContain('picsum');
  });

  it('makes no remote image request at all for an avatar-less row', async () => {
    await renderInbox();

    // Every fixture above has its image field set to null, so ANY remote URI
    // in the tree is one the app invented.
    expect(renderedImageUris().filter((uri) => /^https?:/.test(uri))).toEqual([]);
  });

  it('shows the initials empty state instead, matching the rest of the app', async () => {
    await renderInbox();

    expect(screen.getByText('LL')).toBeTruthy();
    expect(screen.getByText('NC')).toBeTruthy();
    expect(screen.getByText('FM')).toBeTruthy();
  });
});
