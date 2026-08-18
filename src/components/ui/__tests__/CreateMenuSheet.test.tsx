import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

import { CreateMenuSheet } from '../CreateMenuSheet';

/**
 * The "+" create menu.
 *
 * This file exists because of a specific failure: the menu carried a row
 * labelled "A poster" whose handler was `Alert.alert('Coming Soon')`, while the
 * poster generator had in fact shipped and was sitting in section 5 of the
 * create-activity form. The one place a person looks for the feature was the
 * one place that denied it existed, and Aidan failed to find it twice.
 *
 * So the assertion that matters here is not "the sheet renders" — it is that
 * every row NAVIGATES, and that the poster row carries the `?poster=1` the
 * create screen reads to open focused. A row that silently stops going
 * anywhere is exactly the regression this is guarding.
 */

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

/** The sheet closes, then navigates 300ms later so the animation can finish. */
const NAV_DELAY_MS = 300;

async function renderSheet() {
  const onClose = jest.fn();
  const view = render(<CreateMenuSheet visible onClose={onClose} />);
  // The Modal mounts from an effect on `visible`, so wait for real content.
  await waitFor(() => expect(view.getByText('A poster')).toBeTruthy());
  return { ...view, onClose };
}

/** Press a row and let its deferred `router.push` fire. */
function pressAndFlush(view: { getByText: (t: string) => unknown }, label: string) {
  fireEvent.press(view.getByText(label) as Parameters<typeof fireEvent.press>[0]);
  act(() => {
    jest.advanceTimersByTime(NAV_DELAY_MS);
  });
}

describe('CreateMenuSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('offers all three things a person can create', async () => {
    const view = await renderSheet();

    expect(view.getByText('An activity')).toBeTruthy();
    expect(view.getByText('A circle')).toBeTruthy();
    expect(view.getByText('A poster')).toBeTruthy();
  });

  it('sends "A poster" to the create screen with the poster section requested', async () => {
    const view = await renderSheet();

    pressAndFlush(view, 'A poster');

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/create?poster=1');
  });

  it('closes the sheet before navigating, so the row is not a dead end', async () => {
    const view = await renderSheet();

    pressAndFlush(view, 'A poster');

    expect(view.onClose).toHaveBeenCalled();
  });

  /**
   * The regression test proper. "A poster" used to raise a "Coming Soon" alert
   * and go nowhere; nothing in the suite noticed, because nothing asserted that
   * the row navigates at all.
   */
  it('never leaves the poster row inert', async () => {
    const view = await renderSheet();

    pressAndFlush(view, 'A poster');

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(String(mockPush.mock.calls[0][0])).toContain('poster=1');
  });

  it('still routes the other two rows where they belong', async () => {
    const view = await renderSheet();

    pressAndFlush(view, 'An activity');
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/create');

    mockPush.mockClear();

    pressAndFlush(view, 'A circle');
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/create/circle');
  });
});
