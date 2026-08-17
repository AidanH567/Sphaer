import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MyCirclesSection, buildSubtitle } from '@/components/circles/MyCirclesSection';
import type { CircleWithCounts } from '@/types/circle.types';

jest.mock('expo-image', () => {
  const ReactLib = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    Image: (props: Record<string, unknown>) => ReactLib.createElement(View, props),
  };
});

// Icon font loading fires a setState outside act — same approach as the
// other component tests in this repo.
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

// moti ships untranspiled ESM and jest-expo's transformIgnorePatterns doesn't
// cover it, so importing the loading skeleton explodes. Mocked locally rather
// than widening the shared jest config. MotiView is only the shimmer wrapper —
// a plain View preserves the tree the assertions care about.
jest.mock('moti', () => {
  const ReactLib = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    MotiView: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactLib.createElement(View, props, children),
  };
});

function circle(over: Partial<CircleWithCounts> & { id: string; name: string }): CircleWithCounts {
  return {
    description: null,
    tags: null,
    creator_id: 'creator-1',
    avatar_url: null,
    cover_url: null,
    is_public: true,
    created_at: '2026-01-01T00:00:00Z',
    members_count: 3,
    activities_count: 2,
    ...over,
  } as CircleWithCounts;
}

const MEMBER = circle({ id: 'm1', name: 'Techno Collective', is_member: true });
const FOLLOWED = circle({ id: 'f1', name: 'Film Club', is_following: true });

const baseProps = {
  circles: [] as CircleWithCounts[],
  isLoading: false,
  hasSession: true,
  isFiltered: false,
  onSelect: jest.fn(),
};

describe('MyCirclesSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('no session', () => {
    it('renders nothing at all — we cannot know whose circles these are', () => {
      render(<MyCirclesSection {...baseProps} hasSession={false} />);
      expect(screen.queryByTestId('my-circles-section')).toBeNull();
      expect(screen.queryByText('My circles')).toBeNull();
    });

    it('stays hidden even when circles somehow arrive without a session', () => {
      render(<MyCirclesSection {...baseProps} hasSession={false} circles={[MEMBER]} />);
      expect(screen.queryByTestId('my-circles-section')).toBeNull();
    });
  });

  describe('signed in with no circles', () => {
    it('still shows the header, so the entry point is discoverable', () => {
      render(<MyCirclesSection {...baseProps} />);
      expect(screen.getByText('My circles')).toBeTruthy();
    });

    it('invites the user to browse rather than looking broken', () => {
      render(<MyCirclesSection {...baseProps} />);
      expect(
        screen.getByText("You haven't joined a circle yet — browse below and tap one to join.")
      ).toBeTruthy();
    });

    it('distinguishes "no matches for this filter" from "you have none"', () => {
      render(<MyCirclesSection {...baseProps} isFiltered />);
      expect(screen.getByText('None of your circles match this filter.')).toBeTruthy();
      expect(screen.queryByText(/haven't joined a circle yet/)).toBeNull();
    });
  });

  describe('signed in with circles', () => {
    it('lists them by name', () => {
      render(<MyCirclesSection {...baseProps} circles={[MEMBER, FOLLOWED]} />);
      expect(screen.getByText('Techno Collective')).toBeTruthy();
      expect(screen.getByText('Film Club')).toBeTruthy();
    });

    it('names both relationships in the subtitle', () => {
      render(<MyCirclesSection {...baseProps} circles={[MEMBER, FOLLOWED]} />);
      expect(screen.getByText("1 you're in · 1 you follow")).toBeTruthy();
    });

    it('does not show an empty state when it has content', () => {
      render(<MyCirclesSection {...baseProps} circles={[MEMBER]} />);
      expect(screen.queryByText(/haven't joined a circle yet/)).toBeNull();
    });

    it('hands the tapped circle back to the caller', () => {
      const onSelect = jest.fn();
      render(<MyCirclesSection {...baseProps} circles={[MEMBER]} onSelect={onSelect} />);
      fireEvent.press(screen.getByLabelText('Open Techno Collective'));
      expect(onSelect).toHaveBeenCalledWith(MEMBER);
    });
  });

  describe('loading', () => {
    it('shows the header while loading rather than popping in late', () => {
      render(<MyCirclesSection {...baseProps} isLoading />);
      expect(screen.getByText('My circles')).toBeTruthy();
    });

    it('does not claim the user has no circles while still loading', () => {
      render(<MyCirclesSection {...baseProps} isLoading />);
      expect(screen.queryByText(/haven't joined a circle yet/)).toBeNull();
    });

    it('keeps showing already-loaded circles during a refetch', () => {
      render(<MyCirclesSection {...baseProps} isLoading circles={[MEMBER]} />);
      expect(screen.getByText('Techno Collective')).toBeTruthy();
    });
  });
});

describe('buildSubtitle', () => {
  it('names only membership when the user follows nothing extra', () => {
    expect(buildSubtitle(3, 0)).toBe("3 you're in");
  });

  it('names only follows when the user is a member of nothing', () => {
    expect(buildSubtitle(0, 2)).toBe('2 you follow');
  });

  it('names both, separated, when the user has each', () => {
    expect(buildSubtitle(3, 2)).toBe("3 you're in · 2 you follow");
  });

  it('falls back to an explanatory line when both are zero', () => {
    expect(buildSubtitle(0, 0)).toBe('Circles you join or follow show up here');
  });
});
