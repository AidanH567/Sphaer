import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { EventCard } from '../EventCard';
import type { EventWithRelations } from '@/types/event.types';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('expo-image', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  return {
    Image: (props: Record<string, unknown>) => ReactLib.createElement(View, props),
  };
});

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

function makeEvent(overrides: Partial<EventWithRelations> = {}): EventWithRelations {
  return {
    id: 'evt-test',
    creator_id: 'user-1',
    circle_id: null,
    title: 'Synth Jam at Görli',
    description: 'Open-air modular synth session.',
    location_name: 'Görlitzer Park',
    address: 'Görlitzer Str. 1, 10997 Berlin',
    lat: 52.4965,
    lng: 13.4385,
    starts_at: '2026-06-20T20:00:00',
    ends_at: '2026-06-20T23:00:00',
    categories: ['Music'],
    poster_url: 'https://example.com/poster.webp',
    ticket_url: null,
    is_free: true,
    price: null,
    neighbourhood: null,
    borough: null,
    created_at: '2026-06-01T00:00:00',
    creator: null,
    circle: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('EventCard', () => {
  it('renders title, "Free" price for free events, and labels the card "Open {title}"', () => {
    const event = makeEvent();
    const { getByText, getByLabelText } = render(<EventCard event={event} />);

    expect(getByText('Synth Jam at Görli')).toBeTruthy();
    expect(getByText('Free')).toBeTruthy();
    expect(getByLabelText('Open Synth Jam at Görli')).toBeTruthy();
  });

  it('renders the numeric price for paid events', () => {
    const event = makeEvent({ is_free: false, price: 12 });
    const { getByText, queryByText } = render(<EventCard event={event} />);

    expect(getByText('12€')).toBeTruthy();
    expect(queryByText('Free')).toBeNull();
  });

  it('renders no bookmark button when onSave is not provided', () => {
    const event = makeEvent();
    const { queryByLabelText } = render(<EventCard event={event} />);

    expect(queryByLabelText('Save event')).toBeNull();
    expect(queryByLabelText('Remove from saved')).toBeNull();
  });

  it('labels the bookmark "Save event" when not saved and calls onSave once without navigating', () => {
    const event = makeEvent();
    const onSave = jest.fn();
    const { getByLabelText, queryByLabelText } = render(
      <EventCard event={event} onSave={onSave} isSaved={false} />
    );

    const bookmark = getByLabelText('Save event');
    expect(queryByLabelText('Remove from saved')).toBeNull();

    fireEvent.press(bookmark);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('labels the bookmark "Remove from saved" when isSaved and calls onSave once without navigating', () => {
    const event = makeEvent();
    const onSave = jest.fn();
    const { getByLabelText, queryByLabelText } = render(
      <EventCard event={event} onSave={onSave} isSaved={true} />
    );

    const bookmark = getByLabelText('Remove from saved');
    expect(queryByLabelText('Save event')).toBeNull();

    fireEvent.press(bookmark);

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('navigates to /event/{id} when the card body is pressed', () => {
    const event = makeEvent();
    const onSave = jest.fn();
    const { getByLabelText } = render(<EventCard event={event} onSave={onSave} />);

    fireEvent.press(getByLabelText('Open Synth Jam at Görli'));

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/event/evt-test');
    expect(onSave).not.toHaveBeenCalled();
  });
});
