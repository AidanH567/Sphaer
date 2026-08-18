/**
 * Back arrows have to actually go back.
 *
 * ── The bug (Lara's list, item 6) ────────────────────────────────────────────
 * *"on several screens, back arrows / exit icons are missing or not
 * functioning. make them functional on each screen."*
 *
 * Every back chevron was wired straight to `router.back()`, which pops the
 * navigation history — and does NOTHING, silently, when there is no history to
 * pop. That state is not exotic:
 *
 *   - `app/location.tsx` is only ever entered with `router.replace()` (from
 *     `(auth)/onboarding` and `(auth)/signup`). `replace` does not push a
 *     history entry, so this screen's back arrow was dead 100% of the time.
 *   - The `PendingDeepLinkGate` replays deep links with `router.replace()`, so
 *     every deep-linkable route opened with a dead back arrow.
 *   - On the web build every route is directly addressable — a shared link or
 *     a plain page reload leaves nothing behind to pop.
 *
 * These tests press the real chevrons with an empty history and assert the user
 * actually leaves the screen. Against the old code they fail: `back()` is
 * called, `replace()` never is, and the user sits there pressing an arrow that
 * does nothing.
 */

import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
// Flipped per-test to model "arrived by push" vs "arrived by replace / reload".
let mockCanGoBack = true;

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    replace: mockReplace,
    push: mockPush,
    canGoBack: () => mockCanGoBack,
  }),
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

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'denied' })),
  getCurrentPositionAsync: jest.fn(() => Promise.resolve({ coords: { latitude: 0, longitude: 0 } })),
  Accuracy: { Balanced: 3 },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// `user: null` short-circuits the screen's "already onboarded?" effect, so the
// screen settles on its `prompt` phase — the phase that shows the back arrow.
jest.mock('@/context/AuthContext', () => ({
  useAuthContext: () => ({ user: null, profile: null, setProfile: jest.fn() }),
}));

jest.mock('@/context/AppContext', () => ({
  useAppContext: () => ({ feedFilters: {}, setFeedFilters: jest.fn() }),
}));

jest.mock('@/lib/geocoding', () => ({
  reverseGeocodeBerlinLocation: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('@/services/profile.service', () => ({
  updateProfile: jest.fn(() => Promise.resolve({})),
}));

import LocationOnboardingScreen from '../location';
import { LegalScreen } from '@/components/legal/LegalScreen';
import { useGoBack } from '@/hooks/useGoBack';

beforeEach(() => {
  mockBack.mockClear();
  mockReplace.mockClear();
  mockPush.mockClear();
  mockCanGoBack = true;
});

describe('useGoBack', () => {
  function Probe() {
    const goBack = useGoBack('/(tabs)/feed');
    return (
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="probe" onPress={goBack}>
        <Text>probe</Text>
      </TouchableOpacity>
    );
  }

  it('pops history when there is history to pop', () => {
    mockCanGoBack = true;
    render(<Probe />);

    fireEvent.press(screen.getByLabelText('probe'));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('replaces with the fallback when the history stack is empty', () => {
    mockCanGoBack = false;
    render(<Probe />);

    fireEvent.press(screen.getByLabelText('probe'));

    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/feed');
  });

  it('never pushes — unwinding must not grow the stack', () => {
    mockCanGoBack = false;
    render(<Probe />);

    fireEvent.press(screen.getByLabelText('probe'));

    expect(mockPush).not.toHaveBeenCalled();
  });
});

describe('location onboarding — the arrow that was always dead', () => {
  it('leaves the screen even though /location is only ever entered by replace', () => {
    // /location is reached ONLY via router.replace(), so this is not an edge
    // case — it is every single visit.
    mockCanGoBack = false;
    render(<LocationOnboardingScreen />);

    fireEvent.press(screen.getByLabelText('Go back'));

    expect(mockReplace).toHaveBeenCalledWith('/(auth)/onboarding');
  });

  it('still pops normally when something did push it', () => {
    mockCanGoBack = true;
    render(<LocationOnboardingScreen />);

    fireEvent.press(screen.getByLabelText('Go back'));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('legal screens — reachable by direct link, so reachable with no history', () => {
  const props = {
    title: 'Privacy Policy',
    lastUpdated: '2026-06-09',
    intro: 'intro copy',
    sections: [{ heading: '1. A heading', body: 'body copy' }],
  };

  it('the back chevron escapes to the app root on a cold direct open', () => {
    mockCanGoBack = false;
    render(<LegalScreen {...props} />);

    fireEvent.press(screen.getByLabelText('Back'));

    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
