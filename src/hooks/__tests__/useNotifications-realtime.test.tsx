/**
 * Report 3dfb4ca8 — "the notification button goes nowhere."
 *
 * It was never the button. The notifications screen threw during render and
 * Aidan saw the route's error boundary. With the message finally visible in
 * production he sent the exact line:
 *
 *   cannot add `postgres_changes` callbacks for
 *   realtime:notifications:8402bbe4-5ac0-444e-a4db-1ecddf299e83 after
 *   `subscribe()`.
 *
 * ── Why the earlier tests all passed ─────────────────────────────────────────
 * Four of them rendered the screen and it was fine, because they mounted the
 * hook ONCE against a fake `channel()` that cheerfully returned a new object
 * every time. The real client does not: `supabase.channel(topic)` returns the
 * EXISTING channel for a topic that is already open, and calling `.on()` on a
 * subscribed channel throws.
 *
 * The trigger is two simultaneous consumers of this hook with the same
 * `userId` — the bell badge on the profile screen, and the notifications screen
 * pushed as a `card` OVER the tabs, so the profile stays mounted underneath.
 *
 * So the fake below models the two behaviours that actually matter and that
 * every previous fake omitted:
 *   1. the same topic returns the same channel object;
 *   2. `.on()` after `.subscribe()` throws, with the real message.
 *
 * Without those, this bug is untestable — which is precisely how it shipped.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockRows = [
  {
    id: 'n1',
    user_id: 'u1',
    type: 'follow',
    reference_id: 'r1',
    is_read: false,
    created_at: '2026-06-16T20:08:26.513189+00:00',
  },
];

/** Topics that currently exist on the fake client, by name. */
const mockChannels = new Map<string, MockChannel>();
const mockRemoved: string[] = [];

class MockChannel {
  subscribed = false;
  constructor(public topic: string) {}

  on(_event: string, _filter: unknown, _cb: unknown) {
    if (this.subscribed) {
      // The real supabase-js message, verbatim.
      throw new Error(
        'cannot add `postgres_changes` callbacks for realtime:' +
          this.topic +
          ' after `subscribe()`.'
      );
    }
    return this;
  }

  subscribe() {
    this.subscribed = true;
    return this;
  }

  unsubscribe() {
    // Deliberately does NOT free the topic — this is what the real client does
    // and why the fix uses removeChannel instead.
    this.subscribed = false;
  }
}

jest.mock('@/context/AppContext', () => ({
  useAppContext: () => ({ foregroundTick: 0 }),
}));

jest.mock('@/lib/supabase', () => {
  const thenable: Record<string, unknown> = {};
  ['select', 'eq', 'order', 'limit', 'update'].forEach((k) => {
    thenable[k] = () => thenable;
  });
  thenable.then = (cb: (v: unknown) => void) =>
    Promise.resolve(cb({ data: mockRows, error: null }));
  return {
    supabase: {
      from: () => thenable,
      channel: (topic: string) => {
        const existing = mockChannels.get(topic);
        if (existing) return existing;
        const made = new MockChannel(topic);
        mockChannels.set(topic, made);
        return made;
      },
      removeChannel: (ch: MockChannel) => {
        mockRemoved.push(ch.topic);
        mockChannels.delete(ch.topic);
      },
    },
  };
});

import { useNotifications } from '../useNotifications';

function Consumer({ userId }: { userId: string }) {
  const { unreadCount } = useNotifications(userId);
  return <Text>count:{unreadCount}</Text>;
}

beforeEach(() => {
  mockChannels.clear();
  mockRemoved.length = 0;
});

describe('useNotifications — the Realtime topic collision', () => {
  it('two simultaneous consumers for the same user do not throw', async () => {
    // THE REPORTED BUG. The profile bell badge and the notifications screen are
    // both mounted, both for the same user. On the old code the second mount
    // received the first one's subscribed channel and `.on()` threw.
    const { getAllByText } = render(
      <>
        <Consumer userId="u1" />
        <Consumer userId="u1" />
      </>
    );
    await waitFor(() => expect(getAllByText(/count:/).length).toBe(2));
  });

  it('gives each consumer its own topic', () => {
    render(
      <>
        <Consumer userId="u1" />
        <Consumer userId="u1" />
      </>
    );
    const topics = [...mockChannels.keys()];
    expect(topics.length).toBe(2);
    expect(new Set(topics).size).toBe(2);
    // Still identifiable — the user id stays in the topic for debugging.
    topics.forEach((t) => expect(t.startsWith('notifications:u1:')).toBe(true));
  });

  it('frees the topic on unmount with removeChannel, not unsubscribe', () => {
    // `unsubscribe()` leaves the channel in the client registry, so the next
    // `channel(sameTopic)` returns the dead one and `.on()` throws again.
    const view = render(<Consumer userId="u1" />);
    expect(mockChannels.size).toBe(1);
    view.unmount();
    expect(mockRemoved.length).toBe(1);
    expect(mockChannels.size).toBe(0);
  });

  it('a remount after unmount still works', async () => {
    const first = render(<Consumer userId="u1" />);
    first.unmount();
    const second = render(<Consumer userId="u1" />);
    await waitFor(() => expect(second.getByText(/count:/)).toBeTruthy());
  });

  it('different users still get different topics', () => {
    render(
      <>
        <Consumer userId="u1" />
        <Consumer userId="u2" />
      </>
    );
    const topics = [...mockChannels.keys()];
    expect(topics.some((t) => t.startsWith('notifications:u1:'))).toBe(true);
    expect(topics.some((t) => t.startsWith('notifications:u2:'))).toBe(true);
  });
});
