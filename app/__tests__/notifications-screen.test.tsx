/**
 * Aidan, report 3dfb4ca8: "The notification button goes nowhere."
 *
 * It turned out not to be the button at all. Asked what actually happens, he
 * said: "it opens the something went wrong page" — which is
 * `makeRouteErrorBoundary('notifications')`. So the bell navigates correctly
 * and the SCREEN THROWS while rendering, which from the outside is
 * indistinguishable from a dead button.
 *
 * That is why the report sat for a day: everyone (me included) went looking at
 * the bell, the route registration and the router call, all three of which are
 * fine. His screenshot would have shown the error page immediately and it came
 * out blank — the annotation bug, captured three hours before its own fix
 * shipped.
 *
 * This renders the real screen against HIS REAL ROWS (two `follow`, one
 * `message`, taken from production), which is the fixture most likely to
 * reproduce it and the one nobody had tried.
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

const REAL_ROWS = [
  {
    id: '8f1adae9-b076-4970-8839-85e5d2dcbc21',
    user_id: '8402bbe4-5ac0-444e-a4db-1ecddf299e83',
    type: 'follow',
    reference_id: '021bca23-eeae-40dc-aa88-45e6fa8b9de1',
    is_read: false,
    created_at: '2026-06-16T20:08:26.513189+00:00',
  },
  {
    id: '0b9cb75b-1269-405e-9c6f-07318d90fb11',
    user_id: '8402bbe4-5ac0-444e-a4db-1ecddf299e83',
    type: 'message',
    reference_id: '53a9df25-a948-4932-a599-aca1cc10bcf1',
    is_read: false,
    created_at: '2026-06-23T12:00:40.50193+00:00',
  },
];

jest.mock('@/context/AuthContext', () => ({
  useAuthContext: () => ({ user: { id: '8402bbe4-5ac0-444e-a4db-1ecddf299e83' } }),
}));

const mockUseNotifications = jest.fn();
jest.mock('@/hooks/useNotifications', () => ({
  useNotifications: (...a: unknown[]) => mockUseNotifications(...a),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ update: () => ({ eq: () => Promise.resolve({}) }) }) },
}));

import NotificationsScreen from '../../app/notifications';

beforeEach(() => {
  jest.clearAllMocks();
  mockUseNotifications.mockReturnValue({
    notifications: REAL_ROWS,
    unreadCount: 2,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    markAllRead: jest.fn(),
  });
});

describe('the notifications screen', () => {
  it('renders his real rows without throwing', async () => {
    // If this throws, that IS the bug he reported — the error boundary is what
    // he sees, and the exception message says which line.
    const { getByText } = render(<NotificationsScreen />);
    await waitFor(() => expect(getByText('Notifications')).toBeTruthy());
  });

  it('renders the empty state without throwing', async () => {
    mockUseNotifications.mockReturnValue({
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      markAllRead: jest.fn(),
    });
    const { getByText } = render(<NotificationsScreen />);
    await waitFor(() => expect(getByText("You're all caught up")).toBeTruthy());
  });

  it('survives a type the app has never heard of', async () => {
    // FALLBACK_META exists for this; a row whose type is not in the map must
    // not take the whole screen down with it.
    mockUseNotifications.mockReturnValue({
      notifications: [{ ...REAL_ROWS[0], type: 'something_new' }],
      unreadCount: 1,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      markAllRead: jest.fn(),
    });
    const { getByText } = render(<NotificationsScreen />);
    await waitFor(() => expect(getByText('Notifications')).toBeTruthy());
  });

  it('survives a row with no created_at', async () => {
    mockUseNotifications.mockReturnValue({
      notifications: [{ ...REAL_ROWS[0], created_at: null }],
      unreadCount: 1,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      markAllRead: jest.fn(),
    });
    const { getByText } = render(<NotificationsScreen />);
    await waitFor(() => expect(getByText('Notifications')).toBeTruthy());
  });
});
