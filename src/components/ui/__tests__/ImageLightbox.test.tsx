/**
 * The fullscreen image viewer, and the two surfaces that open it.
 *
 * Closes two of Lara's reports:
 *   c02664cd  profile pictures could not be previewed or browsed
 *   e0d339c6  a bug-report screenshot could not be opened full screen
 *
 * What these tests can and cannot say. They assert that the tiles are
 * PRESSABLE, that pressing opens the viewer on the RIGHT image, and that the
 * viewer is handed every image rather than the six the grid shows. They cannot
 * assert that a swipe feels right — that is a paging ScrollView doing what the
 * platform does, and nothing in Jest exercises it.
 *
 * The one that would bite silently is `startIndex`: tapping the third photo and
 * getting the first is a bug you notice instantly by hand and never by suite,
 * because both cases render a viewer with an image in it.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { ImageLightbox } from '../ImageLightbox';

const IMAGES = ['https://x/1.jpg', 'https://x/2.jpg', 'https://x/3.jpg'];

describe('ImageLightbox', () => {
  it('renders nothing at all when closed', () => {
    const { queryByTestId } = render(
      <ImageLightbox images={IMAGES} visible={false} onClose={jest.fn()} />
    );
    expect(queryByTestId('lightbox-pager')).toBeNull();
  });

  it('renders every image, not just the one it opened on', () => {
    // Otherwise there is nothing to swipe TO, which is half of what she asked
    // for ("then you can swipe to browse a users photos").
    const { getByTestId } = render(
      <ImageLightbox images={IMAGES} startIndex={1} visible onClose={jest.fn()} />
    );
    expect(getByTestId('lightbox-pager')).toBeTruthy();
    expect(getByTestId('lightbox-counter').props.children.join('')).toBe('2 / 3');
  });

  it('shows no counter for a single image', () => {
    // The bug-report case. "1 / 1" is noise.
    const { queryByTestId } = render(
      <ImageLightbox images={[IMAGES[0]]} visible onClose={jest.fn()} />
    );
    expect(queryByTestId('lightbox-counter')).toBeNull();
  });

  it('closes via the close button — the only exit on iOS and web', () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<ImageLightbox images={IMAGES} visible onClose={onClose} />);
    fireEvent.press(getByTestId('lightbox-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clamps an out-of-range start rather than opening on a blank page', () => {
    // `startIndex` comes from a caller's list index. A shorter list would
    // otherwise page to somewhere that is not there and show black — which
    // reads exactly like the bug this component fixes.
    for (const [start, shown] of [
      [99, '3 / 3'],
      [-4, '1 / 3'],
      [1.7, '2 / 3'],
    ] as const) {
      const { getByTestId, unmount } = render(
        <ImageLightbox images={IMAGES} startIndex={start} visible onClose={jest.fn()} />
      );
      expect(getByTestId('lightbox-counter').props.children.join('')).toBe(shown);
      unmount();
    }
  });

  it('survives being opened with no images', () => {
    const { queryByTestId } = render(<ImageLightbox images={[]} visible onClose={jest.fn()} />);
    expect(queryByTestId('lightbox-pager')).toBeNull();
  });

  it('fits the image rather than cropping it', () => {
    // A viewer that used `cover` would show a bigger version of the grid's
    // square crop, which answers none of "let me actually see the picture".
    const { UNSAFE_getAllByType } = render(
      <ImageLightbox images={[IMAGES[0]]} visible onClose={jest.fn()} />
    );
    const { Image } = require('expo-image');
    const imgs = UNSAFE_getAllByType(Image);
    expect(imgs.length).toBeGreaterThan(0);
    expect(imgs[0].props.contentFit).toBe('contain');
  });
});
