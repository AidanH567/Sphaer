/**
 * Lara, report c02664cd: "on the personal profile page there is no way to
 * preview a users pictures."
 *
 * The component test above this one proves the viewer works. This proves it is
 * WIRED — that the tiles are pressable and that pressing the third one opens on
 * the third one. Those are separate failures and only the second is silent: a
 * viewer that always opens on image 1 renders perfectly and is wrong.
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { ProfileView } from '../ProfileView';

const IMAGES = ['https://x/a.jpg', 'https://x/b.jpg', 'https://x/c.jpg'];

function profile(images: string[] = IMAGES) {
  // Every field ProfileView reads, so a missing one cannot masquerade as a
  // failure of the thing under test.
  return {
    id: 'u1',
    displayName: 'Lara',
    avatarUrl: 'https://x/avatar.jpg',
    role: '',
    location: '',
    about: '',
    verified: false,
    images,
    activities: [],
    experience: [],
    testimonials: [],
    activitiesCount: 0,
    circlesCount: 0,
    followersCount: 0,
    followingCount: 0,
    instagram: null,
    linkedin: null,
    website: null,
  } as never;
}

function renderView(images: string[] = IMAGES) {
  return render(<ProfileView profile={profile(images)} isOwnProfile />);
}

describe('profile images — press to preview', () => {
  it('makes every tile pressable', () => {
    const { getByTestId } = renderView();
    for (let i = 0; i < IMAGES.length; i++) {
      expect(getByTestId(`profile-image-${i}`)).toBeTruthy();
    }
  });

  it('opens nothing until a tile is pressed', () => {
    const { queryByTestId } = renderView();
    expect(queryByTestId('lightbox-pager')).toBeNull();
  });

  it('opens the viewer ON THE TILE THAT WAS PRESSED', () => {
    // The silent one. Opening on image 1 whichever tile you tap looks correct
    // in every screenshot and is wrong every time but once.
    const { getByTestId } = renderView();
    fireEvent.press(getByTestId('profile-image-2'));
    expect(getByTestId('lightbox-counter').props.children.join('')).toBe('3 / 3');
  });

  it('hands the viewer every image, so swiping can reach them all', () => {
    // The grid caps at six; the viewer must not. Paging a truncated copy would
    // strand images seven onward with no route to them at all.
    const many = Array.from({ length: 9 }, (_, i) => `https://x/${i}.jpg`);
    const { getByTestId } = renderView(many);
    fireEvent.press(getByTestId('profile-image-0'));
    expect(getByTestId('lightbox-counter').props.children.join('')).toBe('1 / 9');
  });

  it('closes again', () => {
    const { getByTestId, queryByTestId } = renderView();
    fireEvent.press(getByTestId('profile-image-1'));
    expect(queryByTestId('lightbox-pager')).toBeTruthy();
    fireEvent.press(getByTestId('lightbox-close'));
    expect(queryByTestId('lightbox-pager')).toBeNull();
  });
});
