export const EVENT_CATEGORIES = [
  'Art',
  'Film',
  'Music',
  'Service',
  'Workshop',
  'Social Movements',
  'Coach',
  'Wellness',
  'Job',
  'Talk',
  'Meet',
  'Education',
  'Therapy',
  'Concert',
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const CIRCLE_TAGS = [
  'Music',
  'Art',
  'Film',
  'Photography',
  'Dance',
  'Theater',
  'Literature',
  'Design',
  'Architecture',
  'Fashion',
  'Food',
  'Tech',
  'Activism',
  'Community',
] as const;

export type CircleTag = (typeof CIRCLE_TAGS)[number];
