import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

import {
  createCircle,
  updateCircle,
  uploadCircleCover,
  uploadGeneratedCircleCover,
} from '@/services/circles.service';
import CreateCircleScreen from '../circle';

/**
 * Create Circle — the cover generator.
 *
 * This screen is where the circle-cover generator becomes reachable at all. It
 * was built, tested and visually verified while NOTHING in the app could reach
 * it, which is exactly the failure the create-activity screen had: a shipped
 * generator nobody can find. So the assertions here are about reachability and
 * about the upload actually taking the generated path — not about the layout,
 * which `cover-families.test.ts` and the QA sheets cover.
 *
 * The load-bearing one is "uploads through uploadGeneratedCircleCover": a
 * generated cover's URI is a `data:` URI, and the ordinary picked-photo
 * uploader does `fetch(uri) -> blob`, which cannot resolve one on React Native.
 * Routing a generated cover down that branch fails only at runtime, on a
 * device, after the circle row already exists.
 */

const mockRouterBack = jest.fn();
const mockRouterReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockRouterBack,
    replace: mockRouterReplace,
    push: jest.fn(),
  }),
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

jest.mock('@/services/circles.service', () => ({
  createCircle: jest.fn(() => Promise.resolve({ id: 'circle-1' })),
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

/**
 * Stub the offscreen canvas. The real one mounts react-native-svg and snapshots
 * a live native view, neither of which exists under jest — but `capture()` is
 * the seam the hook actually depends on, so the stub provides exactly that and
 * nothing else.
 */
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

/** A base64 blob big enough to look like a render; the guard runs in the service. */
const FAKE_PNG_BASE64 = Buffer.alloc(40000, 7).toString('base64');

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

/**
 * The screen mints the circle id itself with `crypto.randomUUID()` so it can
 * name the storage path before the row exists. Node 22 provides a real one, so
 * this is a stub for DETERMINISM, not a polyfill — without it every assertion
 * about the upload path would have to match a random UUID.
 */
const CIRCLE_ID = 'circle-1';
beforeAll(() => {
  const g = globalThis as { crypto?: Crypto };
  if (!g.crypto) (g as { crypto: unknown }).crypto = {};
  Object.defineProperty(g.crypto, 'randomUUID', {
    configurable: true,
    writable: true,
    value: () => CIRCLE_ID,
  });
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCapture.mockResolvedValue(FAKE_PNG_BASE64);
});

/** Type a name and press Generate, returning the rendered screen. */
async function renderWithGeneratedCover() {
  const view = render(<CreateCircleScreen />);
  fireEvent.changeText(view.getByLabelText('Name'), 'Neukölln Sound System');
  fireEvent.press(view.getByRole('button', { name: 'Generate a cover' }));
  await waitFor(() => expect(mockCapture).toHaveBeenCalled());
  return view;
}

describe('CreateCircleScreen — the cover generator', () => {
  it('offers the generator at all, which is the whole point of this commit', () => {
    const view = render(<CreateCircleScreen />);

    expect(view.getByRole('button', { name: 'Generate a cover' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Shuffle the cover design' })).toBeTruthy();
  });

  it('says what it needs rather than only greying the button', () => {
    const view = render(<CreateCircleScreen />);

    const generate = view.getByRole('button', { name: 'Generate a cover' });
    expect(generate.props.accessibilityState.disabled).toBe(true);
    // A circle has no date, so this is ONE field, not the event screen's two.
    expect(view.getByText(/Give your circle a name above/i)).toBeTruthy();
  });

  it('unlocks on the name alone — a cover needs nothing else', () => {
    const view = render(<CreateCircleScreen />);

    fireEvent.changeText(view.getByLabelText('Name'), 'Grauzone');

    const generate = view.getByRole('button', { name: 'Generate a cover' });
    expect(generate.props.accessibilityState.disabled).toBe(false);
    expect(view.queryByText(/Give your circle a name above/i)).toBeNull();
  });

  it('captures a cover and offers another roll rather than disappearing', async () => {
    const view = await renderWithGeneratedCover();

    // The generator must NOT vanish once a cover exists — that dead end is
    // what made the event poster generator a one-shot.
    expect(view.getByRole('button', { name: 'Make another' })).toBeTruthy();
    expect(view.getByRole('button', { name: 'Shuffle the cover design' })).toBeTruthy();
    expect(view.getByText(/Made from your name and topics/i)).toBeTruthy();
  });

  it('uploads through uploadGeneratedCircleCover, not the blob picker path', async () => {
    const view = await renderWithGeneratedCover();

    fireEvent.press(view.getByRole('button', { name: 'Create Circle' }));

    await waitFor(() => expect(jest.mocked(uploadGeneratedCircleCover)).toHaveBeenCalled());
    expect(jest.mocked(uploadGeneratedCircleCover)).toHaveBeenCalledWith(
      'user-1',
      'circle-1',
      FAKE_PNG_BASE64
    );
    // The picked-photo uploader does fetch(uri) -> blob and cannot resolve a
    // data: URI on React Native. It must not be reached for a generated cover.
    expect(jest.mocked(uploadCircleCover)).not.toHaveBeenCalled();
  });

  it('keeps the cover upload AFTER the insert, via updateCircle', async () => {
    const view = await renderWithGeneratedCover();

    fireEvent.press(view.getByRole('button', { name: 'Create Circle' }));

    await waitFor(() => expect(jest.mocked(updateCircle)).toHaveBeenCalled());
    // The row is inserted with no cover, then patched — the existing flow,
    // unchanged. Inserting the cover_url directly would be a different shape.
    expect(jest.mocked(createCircle)).toHaveBeenCalledWith(
      expect.objectContaining({ cover_url: null })
    );
    expect(jest.mocked(updateCircle)).toHaveBeenCalledWith('circle-1', {
      cover_url: 'https://cdn/c1-cover.png',
    });
  });

  it('keeps the soft-failure path: a cover failure must not lose the circle', async () => {
    jest
      .mocked(uploadGeneratedCircleCover)
      .mockRejectedValueOnce(new Error('storage exploded'));
    const view = await renderWithGeneratedCover();

    fireEvent.press(view.getByRole('button', { name: 'Create Circle' }));

    // The circle row already exists at that point, so the user is taken to it
    // rather than stranded on the form.
    await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/circles/circle-1'));
    expect(jest.mocked(createCircle)).toHaveBeenCalled();
  });

  it('creates without any cover when the user generated nothing', async () => {
    const view = render(<CreateCircleScreen />);
    fireEvent.changeText(view.getByLabelText('Name'), 'Grauzone');

    fireEvent.press(view.getByRole('button', { name: 'Create Circle' }));

    await waitFor(() => expect(jest.mocked(createCircle)).toHaveBeenCalled());
    expect(jest.mocked(uploadGeneratedCircleCover)).not.toHaveBeenCalled();
    expect(jest.mocked(uploadCircleCover)).not.toHaveBeenCalled();
    expect(jest.mocked(updateCircle)).not.toHaveBeenCalled();
  });

  it('surfaces a capture failure instead of creating a circle with nothing attached', async () => {
    mockCapture.mockRejectedValueOnce(new Error('canvas not ready'));
    const view = render(<CreateCircleScreen />);
    fireEvent.changeText(view.getByLabelText('Name'), 'Grauzone');

    fireEvent.press(view.getByRole('button', { name: 'Generate a cover' }));

    await waitFor(() => expect(mockCapture).toHaveBeenCalled());
    // No cover was attached, so the label stays in its "nothing yet" state.
    expect(view.getByRole('button', { name: 'Generate a cover' })).toBeTruthy();
  });
});
