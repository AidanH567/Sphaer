import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import { updateCircle, uploadCircleCover, uploadGeneratedCircleCover } from '@/services/circles.service';
import EditCircleScreen from '../[id]';

/**
 * Edit Circle — the cover generator.
 *
 * This screen is where the trap lives. Its save handler used to decide whether
 * to upload by comparing the preview URI against the stored one:
 *
 *     if (coverUri && coverUri !== circle.cover_url) uploadCircleCover(...)
 *
 * A generated cover's `coverUri` is a `data:` URI. It always differs from the
 * stored https URL, so it falls into that branch — and `uploadCircleCover` does
 * `fetch(uri) -> blob`, which cannot resolve a data: URI on React Native. The
 * failure is invisible in a type check, invisible in a layout test, and only
 * shows up on a device. So the generated case is now decided by its own flag,
 * checked FIRST, and this file holds that.
 *
 * The other thing worth holding: this screen almost always HAS a cover, so a
 * generator hidden behind "only when empty" would be permanently unreachable
 * here — for exactly the circles whose covers most need replacing.
 */

const mockRouterBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockRouterBack, replace: jest.fn(), push: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'circle-1' }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuthContext: () => ({
    session: null,
    user: { id: 'user-1' },
    profile: null,
    isLoading: false,
    setProfile: jest.fn(),
  }),
}));

const CIRCLE = {
  id: 'circle-1',
  creator_id: 'user-1',
  name: 'Berlin Shiatsu',
  description: 'Bodywork evenings',
  tags: ['Wellness'],
  avatar_url: null,
  cover_url: 'https://cdn/old-cover.jpg',
  is_public: true,
  created_at: '2026-01-01T00:00:00.000Z',
  members_count: 3,
  activities_count: 1,
};

jest.mock('@/hooks/useCircles', () => ({
  useCircle: () => ({
    circle: CIRCLE,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/services/circles.service', () => ({
  updateCircle: jest.fn(() => Promise.resolve({ id: 'circle-1' })),
  uploadCircleImage: jest.fn(() => Promise.resolve('https://cdn/avatar.jpg')),
  uploadCircleCover: jest.fn(() => Promise.resolve('https://cdn/cover.jpg')),
  uploadGeneratedCircleCover: jest.fn(() => Promise.resolve('https://cdn/c1-cover.png')),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true })),
  MediaTypeOptions: { Images: 'Images' },
}));

jest.mock('expo-image', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { Image: View };
});

/** A base64 blob big enough to look like a render; the guard runs in the service. */
const FAKE_PNG_BASE64 = Buffer.alloc(40000, 7).toString('base64');

const mockCapture = jest.fn(() => Promise.resolve(FAKE_PNG_BASE64));
jest.mock('@/components/events/GeneratedPosterCanvas', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    posterCanvasHostStyle: {},
    GeneratedPosterCanvas: ReactActual.forwardRef(function Stub(
      _props: { layout: unknown },
      ref: import('react').Ref<{ capture: () => Promise<string> }>
    ) {
      ReactActual.useImperativeHandle(ref, () => ({ capture: mockCapture }), []);
      return ReactActual.createElement(View, null);
    }),
  };
});

jest.mock('react-native-safe-area-context', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
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
  return {
    SafeAreaView,
    SafeAreaProvider: ({ children }: { children?: import('react').ReactNode }) =>
      ReactActual.createElement(ReactActual.Fragment, null, children),
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
  };
});

jest.setTimeout(20000);

beforeEach(() => {
  jest.clearAllMocks();
  mockCapture.mockResolvedValue(FAKE_PNG_BASE64);
});

describe('EditCircleScreen — the cover generator', () => {
  it('offers the generator even though the circle already has a cover', () => {
    const view = render(<EditCircleScreen />);

    // Hiding it behind "only when empty" would make it unreachable on the one
    // screen whose whole job is replacing what is already there. The label is
    // "Generate one instead" rather than "Generate a cover" because a cover is
    // already on screen — the button says what pressing it will do from here.
    expect(view.getByRole('button', { name: 'Generate one instead' })).toBeTruthy();
  });

  /**
   * Shuffle is withheld while the STORED cover is showing, and that is
   * deliberate rather than an oversight. We cannot tell whether the stored
   * image was generated or a photo the creator uploaded, so shuffling would
   * re-solve a layout the preview is not displaying and read as a dead button.
   * Generate once, and Shuffle appears — see the test below.
   */
  it('withholds Shuffle until something generated is actually on screen', async () => {
    const view = render(<EditCircleScreen />);

    expect(view.queryByRole('button', { name: 'Shuffle the cover design' })).toBeNull();

    fireEvent.press(view.getByRole('button', { name: 'Generate one instead' }));
    await waitFor(() => expect(mockCapture).toHaveBeenCalled());

    expect(view.getByRole('button', { name: 'Shuffle the cover design' })).toBeTruthy();
  });

  it('is ready immediately, because the name is hydrated from the circle', () => {
    const view = render(<EditCircleScreen />);

    const generate = view.getByRole('button', { name: 'Generate one instead' });
    expect(generate.props.accessibilityState.disabled).toBe(false);
  });

  /**
   * The load-bearing test. A `data:` URI differs from the stored https URL, so
   * the old URI-changed comparison would route a generated cover into
   * `uploadCircleCover` — fetch(uri) -> blob — which cannot resolve it on RN.
   */
  it('saves a generated cover through the base64 path, never the blob path', async () => {
    const view = render(<EditCircleScreen />);

    fireEvent.press(view.getByRole('button', { name: 'Generate one instead' }));
    await waitFor(() => expect(mockCapture).toHaveBeenCalled());

    fireEvent.press(view.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(jest.mocked(uploadGeneratedCircleCover)).toHaveBeenCalled());
    expect(jest.mocked(uploadGeneratedCircleCover)).toHaveBeenCalledWith(
      'user-1',
      'circle-1',
      FAKE_PNG_BASE64
    );
    expect(jest.mocked(uploadCircleCover)).not.toHaveBeenCalled();
    expect(jest.mocked(updateCircle)).toHaveBeenCalledWith(
      'circle-1',
      expect.objectContaining({ cover_url: 'https://cdn/c1-cover.png' })
    );
  });

  it('leaves an untouched cover alone — no upload, no cover_url in the patch', async () => {
    const view = render(<EditCircleScreen />);

    fireEvent.press(view.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(jest.mocked(updateCircle)).toHaveBeenCalled());
    expect(jest.mocked(uploadGeneratedCircleCover)).not.toHaveBeenCalled();
    expect(jest.mocked(uploadCircleCover)).not.toHaveBeenCalled();
    const patch = jest.mocked(updateCircle).mock.calls[0][1];
    expect(patch).not.toHaveProperty('cover_url');
  });

  it('offers another roll after generating rather than disappearing', async () => {
    const view = render(<EditCircleScreen />);

    fireEvent.press(view.getByRole('button', { name: 'Generate one instead' }));
    await waitFor(() => expect(mockCapture).toHaveBeenCalled());

    expect(view.getByRole('button', { name: 'Make another' })).toBeTruthy();
    expect(view.getByText(/Save to attach it/i)).toBeTruthy();
  });

  it('does not save a cover when the capture failed', async () => {
    mockCapture.mockRejectedValueOnce(new Error('canvas not ready'));
    const view = render(<EditCircleScreen />);

    fireEvent.press(view.getByRole('button', { name: 'Generate one instead' }));
    await waitFor(() => expect(mockCapture).toHaveBeenCalled());

    fireEvent.press(view.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(jest.mocked(updateCircle)).toHaveBeenCalled());
    expect(jest.mocked(uploadGeneratedCircleCover)).not.toHaveBeenCalled();
  });
});
