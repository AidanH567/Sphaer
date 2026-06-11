import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

// ---------------------------------------------------------------------------
// Mocks — everything the Create screen reaches for outside pure RN rendering.
// All inline per testing policy (no shared setup files).
// ---------------------------------------------------------------------------

const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockRouterBack,
    replace: mockRouterReplace,
    push: jest.fn(),
  }),
}));

// Auth: mock at the context-hook level so we don't need the real provider
// (which would drag in the supabase client + realtime).
jest.mock('@/context/AuthContext', () => ({
  useAuthContext: () => ({
    session: null,
    user: { id: 'user-1' },
    profile: null,
    isLoading: false,
    setProfile: jest.fn(),
  }),
}));

jest.mock('@/services/events.service', () => ({
  createEvent: jest.fn(() => Promise.resolve()),
  uploadEventPoster: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('@/services/circles.service', () => ({
  getAdminCircles: jest.fn(() => Promise.resolve([])),
}));

jest.mock('@/lib/geocoding', () => ({
  geocodeAddress: jest.fn(() => Promise.resolve(null)),
}));

// AddressAutocompleteInput's Google Places client — never let it fetch.
jest.mock('@/lib/places', () => ({
  searchPlaces: jest.fn(() => Promise.resolve([])),
  getPlaceDetails: jest.fn(() => Promise.resolve(null)),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() =>
    Promise.resolve({ granted: false })
  ),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true })),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('expo-image', () => {
  const { View } = jest.requireActual<typeof import('react-native')>(
    'react-native'
  );
  return { Image: View };
});

// DateTimeField renders the native picker module — stub it out so the field
// chrome (label / placeholder / error) renders without native code.
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: jest.fn(() => null),
  DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
}));

// Hand-rolled safe-area mock: the library's official jest mock exports
// everything under `default`, which trips NativeWind's css-interop JSX
// wrapper (it expects named exports with displayName-able components).
jest.mock('react-native-safe-area-context', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>(
    'react-native'
  );
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };

  function SafeAreaView({
    children,
    style,
  }: {
    children?: import('react').ReactNode;
    style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
    edges?: readonly string[];
  }) {
    return ReactActual.createElement(View, { style }, children);
  }

  function SafeAreaProvider({
    children,
  }: {
    children?: import('react').ReactNode;
  }) {
    return ReactActual.createElement(ReactActual.Fragment, null, children);
  }

  return {
    SafeAreaView,
    SafeAreaProvider,
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
  };
});

// Imports of the mocked services so assertions can reach the jest.fn()s.
import { createEvent, uploadEventPoster } from '@/services/events.service';
import { getAdminCircles } from '@/services/circles.service';
import CreateScreen from '../index';

const TITLE_ERROR = 'Please add a title for your activity.';
const STARTS_AT_ERROR = 'Please pick a start date and time.';

/**
 * Renders the screen and flushes the getAdminCircles() promise the mount
 * effect kicks off, so its setState lands inside act().
 *
 * Note: queries come from the returned render result (not the global
 * `screen` export, which stays unbound under this jest-expo + NativeWind
 * jsxImportSource setup).
 */
async function renderCreateScreen() {
  const view = render(<CreateScreen />);
  // Flush the mount effect via waitFor — React 19's async act() hangs
  // indeterminately under jest-expo, so poll for the observable side
  // effect of the effect having run instead.
  await waitFor(() => expect(jest.mocked(getAdminCircles)).toHaveBeenCalledWith('user-1'));
  return view;
}

jest.setTimeout(20000);

describe('CreateScreen — create-event form validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the form with the Publish activity CTA and nav a11y affordances', async () => {
    const view = await renderCreateScreen();

    // Submit CTA is exposed as an accessible button.
    expect(view.getByRole('button', { name: 'Publish' })).toBeTruthy();

    // Screen chrome + a11y sweep regressions.
    expect(view.getByText('Create Activity')).toBeTruthy();
    expect(view.getByRole('button', { name: 'Go back' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Add poster image' })).toBeTruthy();

    // Free/Paid toggle exposes selection state; Free is the default.
    expect(
      view.getByRole('button', { name: 'Free' }).props.accessibilityState
    ).toEqual({ selected: true });
    expect(
      view.getByRole('button', { name: 'Paid' }).props.accessibilityState
    ).toEqual({ selected: false });
  });

  it('shows inline required-field errors on empty submit and calls no create service', async () => {
    const view = await renderCreateScreen();

    fireEvent.press(view.getByRole('button', { name: 'Publish' }));

    // Both required-field errors surface at once (not sequential popups).
    expect(await view.findByText(TITLE_ERROR)).toBeTruthy();
    expect(view.getByText(STARTS_AT_ERROR)).toBeTruthy();

    // Validation short-circuits before any service call.
    expect(jest.mocked(createEvent)).not.toHaveBeenCalled();
    expect(jest.mocked(uploadEventPoster)).not.toHaveBeenCalled();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('clears the title error as soon as the user types into the title field', async () => {
    const view = await renderCreateScreen();

    fireEvent.press(view.getByRole('button', { name: 'Publish' }));
    expect(await view.findByText(TITLE_ERROR)).toBeTruthy();

    // The Title input has no unique placeholder or accessibility label
    // (limitation of the current markup) — it is the first empty text input
    // in render order. The assertion below self-validates the targeting:
    // only typing in the *title* field clears the title error.
    const titleInput = view.getAllByDisplayValue('')[0];
    fireEvent.changeText(titleInput, 'Warehouse jam session');

    // Text landed in the field we targeted…
    expect(view.getByDisplayValue('Warehouse jam session')).toBeTruthy();
    // …its error cleared on edit…
    expect(view.queryByText(TITLE_ERROR)).toBeNull();
    // …while unrelated field errors persist (clear-on-edit is per-field).
    expect(view.getByText(STARTS_AT_ERROR)).toBeTruthy();

    // Still no service call — clearing an error must not submit.
    expect(jest.mocked(createEvent)).not.toHaveBeenCalled();
  });
});
