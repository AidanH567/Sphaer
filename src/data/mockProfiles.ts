/**
 * Mock profile data for the personal / artist profile page.
 *
 * Single source of truth while Supabase profiles are not wired to the UI.
 * `getMockProfileById()` falls back to the demo profile for unknown ids so
 * tapping any creator / host never throws a routing error.
 *
 * To go live: replace `getMockProfileById()` with `useProfile()`
 * (src/hooks/useProfile.ts) once auth + the profiles table are connected.
 */

export interface ProfileActivity {
  id: string;
  title: string;
  dateLabel: string; // "Tue 5 May"
  timeLabel: string; // "21:00-23:30"
  location: string;
  price: string; // "50€" | "Free"
  image: string;
}

export interface ProfileExperience {
  id: string;
  /** Full role line, e.g. "Senior Digital Designer • Freelance • 2019-Present". */
  title: string;
  description: string;
}

export interface ProfileTestimonial {
  id: string;
  /** "Nina S. · Filmmaker" */
  author: string;
  quote: string;
}

export interface MockProfile {
  id: string;
  displayName: string;
  role: string;
  location: string;
  website: string;
  avatarUrl: string;
  verified: boolean;
  followersCount: number;
  followingCount: number;
  circlesCount: number;
  activitiesCount: number;
  about: string;
  activities: ProfileActivity[];
  experience: ProfileExperience[];
  testimonials: ProfileTestimonial[];
  images: string[];
}

const poster = (seed: string) => `https://picsum.photos/seed/${seed}/500/700`;

export const MOCK_PROFILES: MockProfile[] = [
  {
    id: 'lea-weber',
    displayName: 'Lea Weber',
    role: 'Filmmaker & Workshop Facilitator',
    location: 'Berlin, Germany',
    website: 'leaweberfilm.com',
    avatarUrl: 'https://i.pravatar.cc/300?img=47',
    verified: true,
    followersCount: 850,
    followingCount: 217,
    circlesCount: 4,
    activitiesCount: 3,
    about:
      "I'm Lea Weber, a digital film maker based in Berlin with over 11 years of experience crafting thoughtful, visually driven digital film experiences. Together, we'll explore the challenges crews face and practice staying calm, creative, and adaptable when things don't go as planned.",
    activities: [
      {
        id: 'pa-lea-1',
        title: 'Workshop: Collaborating On Set',
        dateLabel: 'Tue 5 May',
        timeLabel: '21:00-23:30',
        location: 'Maybachufer 31',
        price: '50€',
        image: poster('sphaer-profile-set'),
      },
      {
        id: 'pa-lea-2',
        title: 'Talk: How I Shot That: The Cameras and Lenses',
        dateLabel: 'Sun 15 May',
        timeLabel: '20:00-21:30',
        location: 'Moviemento',
        price: 'Free',
        image: poster('sphaer-profile-cameras'),
      },
      {
        id: 'pa-lea-3',
        title: 'Film Screening & Talk: Documentary Fire of Love',
        dateLabel: 'Thu 28 May',
        timeLabel: '21:00-23:30',
        location: 'hub27 Berlin',
        price: 'Free',
        image: poster('sphaer-profile-fire'),
      },
    ],
    experience: [
      {
        id: 'pe-lea-1',
        title: 'Senior Digital Designer • Freelance • 2019-Present',
        description:
          'Working with startups, agencies, and brands to design digital experiences that balance aesthetics and usability.',
      },
      {
        id: 'pe-lea-2',
        title: 'Digital Designer • Creative Studio • 2015 — 2019',
        description:
          'Designed modern websites and brand visuals, collaborating with developers and creatives to deliver cohesive digital experiences across multiple platforms.',
      },
      {
        id: 'pe-lea-3',
        title: 'Graphic Designer • Media Agency • 2012 - 2015',
        description:
          'Produced motion graphics, animations, and edited video content for marketing campaigns, social media, and promotional.',
      },
      {
        id: 'pe-lea-4',
        title: 'Web Designer • Design Agency • 2010 — 2012',
        description:
          'Supported website design projects, created visual assets, and assisted in building responsive layouts while developing a strong foundation in digital.',
      },
    ],
    testimonials: [
      {
        id: 'pt-lea-1',
        author: 'Nina S. · Filmmaker',
        quote:
          'Lea brings such a thoughtful and inspiring energy to every workshop. Her hands-on approach made filmmaking feel accessible, creative, and genuinely exciting.',
      },
      {
        id: 'pt-lea-2',
        author: 'Daniel K. · Screenwriter',
        quote:
          'Working with Lea was a fantastic experience. She creates a space where ideas feel welcome, and her guidance helped me refine my script with more clarity and confidence.',
      },
      {
        id: 'pt-lea-3',
        author: 'Amina R. · Film Student',
        quote:
          "Lea's workshop was engaging, practical, and deeply motivating. I left with new skills, fresh ideas, and a much stronger understanding of the screenwriting process.",
      },
      {
        id: 'pt-lea-4',
        author: 'Leo M. · Independent Director',
        quote:
          'She has a rare ability to make learning feel personal and collaborative. Her studio screenings and workshops are always insightful, well-curated, and memorable.',
      },
    ],
    images: [
      'https://picsum.photos/seed/sphaer-profile-studio/900/560',
      'https://picsum.photos/seed/sphaer-profile-shoot/900/560',
      'https://picsum.photos/seed/sphaer-profile-crew/900/560',
    ],
  },
];

/** The logged-in user's profile id (mock — stands in for the auth user). */
export const CURRENT_USER_PROFILE_ID = 'lea-weber';

/**
 * Look up a profile by id. Falls back to the demo profile for unknown ids
 * so any creator / host tap resolves to a populated page.
 *
 * Used as the dev-mode fallback on /profile when there's no auth session.
 * For routing to OTHER users (where a wrong fallback is misleading), use
 * `getMockProfileByExactId()` instead.
 */
export function getMockProfileById(id?: string): MockProfile {
  return MOCK_PROFILES.find((p) => p.id === id) ?? MOCK_PROFILES[0];
}

/**
 * Exact-match lookup with no silent fallback. Returns `null` when nothing
 * matches — the /user/[id] route uses this so an unknown id surfaces a
 * "Profile not found" state instead of opening the wrong person's page.
 */
export function getMockProfileByExactId(id: string | undefined | null): MockProfile | null {
  if (!id) return null;
  return MOCK_PROFILES.find((p) => p.id === id) ?? null;
}
