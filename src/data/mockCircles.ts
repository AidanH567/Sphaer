/**
 * Mock circle data for the Circles explore page and Circle detail page.
 *
 * Single source of truth while the Supabase `circles` table is empty.
 * Field names mirror the DB row (`avatar_url`, `cover_url`, `description`,
 * `members_count`, `activities_count`, `is_member`) so the UI can be swapped
 * to live data later. The display-only extras — `upcomingActivities`,
 * `membersPreview`, `communityPosts` — come from other tables in the real
 * schema (events, circle_members, posts) and would be fetched separately.
 *
 * The Circle detail page is a single dynamic Expo Router route
 * (app/(tabs)/circles/[id].tsx) — every circle below is automatically
 * reachable at /circles/<id> with no extra files.
 */

export interface MockCircleActivity {
  id: string;
  title: string;
  dateLabel: string; // "Sat 26 May"
  timeLabel: string; // "19:00-23:00"
  image: string;
  location?: string;
  price?: string;
}

export interface MockCircleMember {
  id: string;
  name: string;
  avatar: string;
}

export interface MockCommunityPost {
  id: string;
  title: string;
  author: string;
}

export interface MockCircle {
  id: string;
  name: string;
  category: string;
  description: string;
  avatar_url: string;
  cover_url: string;
  members_count: number;
  activities_count: number;
  is_member: boolean;
  upcomingActivities: MockCircleActivity[];
  membersPreview: MockCircleMember[];
  communityPosts: MockCommunityPost[];
}

export interface MockCircleCategory {
  id: string;
  title: string;
  subtitle: string;
  circleIds: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const avatar = (seed: string) => `https://picsum.photos/seed/${seed}/400/400`;
const cover = (seed: string) => `https://picsum.photos/seed/${seed}/900/500`;
const face = (n: number) => `https://i.pravatar.cc/150?img=${n}`;

/** Build a 5-person members preview from pravatar ids. */
function previewMembers(ids: number[]): MockCircleMember[] {
  return ids.map((n) => ({ id: `m-${n}`, name: `Member ${n}`, avatar: face(n) }));
}

/** Build an activity. `seed` picks the placeholder image. */
function activity(
  id: string,
  title: string,
  dateLabel: string,
  timeLabel: string,
  seed: string,
  extra?: { location?: string; price?: string }
): MockCircleActivity {
  return { id, title, dateLabel, timeLabel, image: avatar(seed), ...extra };
}

function post(id: string, title: string, author: string): MockCommunityPost {
  return { id, title, author };
}

/** Compact circle builder — keeps the data list readable. */
function makeCircle(c: {
  id: string;
  name: string;
  category: string;
  description: string;
  members: number;
  activities: number;
  faces: number[];
  upcoming: MockCircleActivity[];
  isMember?: boolean;
  posts?: MockCommunityPost[];
}): MockCircle {
  return {
    id: c.id,
    name: c.name,
    category: c.category,
    description: c.description,
    avatar_url: avatar(`c-${c.id}`),
    cover_url: cover(`c-${c.id}-cover`),
    members_count: c.members,
    activities_count: c.activities,
    is_member: c.isMember ?? false,
    upcomingActivities: c.upcoming,
    membersPreview: previewMembers(c.faces),
    communityPosts: c.posts ?? [],
  };
}

// ─── Circles ──────────────────────────────────────────────────────────────────

export const MOCK_CIRCLES: MockCircle[] = [
  // ── Film ──
  makeCircle({
    id: 'berlin-film-community',
    name: 'Berlin Film Community',
    category: 'Film',
    description:
      'From underground screenings in Neukölln to retrospectives at Filmhaus, this circle is for anyone who takes cinema seriously in Berlin.',
    members: 1402,
    activities: 34,
    isMember: true,
    faces: [11, 12, 13, 14, 15],
    upcoming: [
      activity('a-bfc-1', 'Documentary: Night The Eternal Memory', 'Sat 26 May', '19:00-23:00', 'act-doc', {
        location: 'Filmhaus Berlin',
        price: 'Free',
      }),
      activity('a-bfc-2', 'Short Film Evening Berlin Independents', 'Fri 12 Jul', '10:00-01:30', 'act-short', {
        location: 'Neukölln',
        price: '8€',
      }),
      activity('a-bfc-3', 'Film & Talk: Women Behind the Camera', 'Mon 08 Jul', '16:00-19:00', 'act-talk', {
        location: 'Kino International',
      }),
    ],
    posts: [
      post('p-bfc-1', 'Seeking Cinematographer (Short Film)', 'Jonas R.'),
      post('p-bfc-2', 'Free editing suite available this weekend', 'Mira K.'),
    ],
  }),
  makeCircle({
    id: 'screenwriters-directors',
    name: 'Screenwriters & Directors',
    category: 'Film',
    description:
      'A working circle for people who write and direct. Table reads, feedback nights and honest notes — no egos.',
    members: 1402,
    activities: 34,
    faces: [21, 22, 23, 24, 25],
    upcoming: [
      activity('a-swd-1', 'Table Read: New Drafts Night', 'Thu 29 May', '18:30-21:00', 'act-read'),
      activity('a-swd-2', 'Directing Workshop: Blocking a Scene', 'Sat 07 Jun', '11:00-15:00', 'act-direct', {
        price: '20€',
      }),
    ],
    posts: [post('p-swd-1', 'Looking for a co-writer (feature)', 'Lena H.')],
  }),
  makeCircle({
    id: 'documentary-lovers',
    name: 'Documentary Lovers',
    category: 'Film',
    description:
      'For people who believe the truth is stranger than fiction. Monthly screenings, filmmaker Q&As and field trips.',
    members: 7402,
    activities: 525,
    faces: [31, 32, 33, 34, 35],
    upcoming: [
      activity('a-doc-1', 'Screening: The Salt of the Earth', 'Wed 04 Jun', '20:00-22:30', 'act-salt'),
      activity('a-doc-2', 'Doc Pitch Night', 'Fri 13 Jun', '19:00-22:00', 'act-pitch', { price: 'Free' }),
    ],
    posts: [post('p-doc-1', 'Archive footage sources — share yours', 'Theo M.')],
  }),
  makeCircle({
    id: 'scenelab',
    name: 'SceneLab',
    category: 'Film',
    description:
      'An experimental lab for actors and directors to test scenes in a low-pressure room. Drop in, try things, fail well.',
    members: 612,
    activities: 88,
    faces: [41, 42, 43, 44, 45],
    upcoming: [
      activity('a-sl-1', 'Open Scene Lab', 'Tue 03 Jun', '18:00-21:00', 'act-lab'),
      activity('a-sl-2', 'Cold Read Night', 'Tue 17 Jun', '18:00-21:00', 'act-coldread'),
    ],
  }),
  makeCircle({
    id: 'lgbtqia-film',
    name: 'LGBTQIA+ in Film',
    category: 'Film',
    description:
      'A safe, loud, joyful circle for queer filmmakers and film lovers. Screenings, mentorship and community above all.',
    members: 2980,
    activities: 141,
    faces: [51, 52, 53, 54, 55],
    upcoming: [
      activity('a-lg-1', 'Pride Shorts Programme', 'Sat 21 Jun', '17:00-21:00', 'act-pride', { price: 'Free' }),
      activity('a-lg-2', 'Queer Cinema Book Club', 'Thu 12 Jun', '19:00-21:00', 'act-qbook'),
    ],
    posts: [post('p-lg-1', 'Mentorship sign-ups now open', 'Robin A.')],
  }),
  makeCircle({
    id: 'berlin-cinephiles',
    name: 'Berlin Cinephiles',
    category: 'Film',
    description:
      'Weekly arthouse screenings and long arguments about them — from silent cinema to brand-new releases.',
    members: 4120,
    activities: 198,
    faces: [26, 27, 28, 29, 30],
    upcoming: [
      activity('a-cin-1', 'Silent Film Night with Live Score', 'Fri 06 Jun', '20:00-22:30', 'act-silent', {
        price: '12€',
      }),
      activity('a-cin-2', 'New Releases Discussion', 'Wed 18 Jun', '19:00-21:00', 'act-newrelease'),
    ],
  }),
  makeCircle({
    id: 'experimental-film-lab',
    name: 'Experimental Film Lab',
    category: 'Film',
    description:
      '16mm, found footage and projector performances — a circle that treats film as a material, not just a story.',
    members: 880,
    activities: 64,
    faces: [36, 37, 38, 39, 40],
    upcoming: [
      activity('a-exp-1', 'Hand-Processing Workshop', 'Sat 14 Jun', '12:00-17:00', 'act-process', { price: '30€' }),
      activity('a-exp-2', 'Expanded Cinema Performance', 'Fri 27 Jun', '21:00-23:00', 'act-expanded'),
    ],
  }),

  // ── Music ──
  makeCircle({
    id: 'techno-producers-berlin',
    name: 'Techno Producers Berlin',
    category: 'Music',
    description:
      'Patch notes, mixdown clinics and listening sessions for everyone shaping Berlin’s techno sound.',
    members: 9240,
    activities: 612,
    faces: [1, 2, 3, 4, 5],
    upcoming: [
      activity('a-tp-1', 'Mixdown Clinic: Bring a Track', 'Mon 09 Jun', '19:00-22:00', 'act-mixdown'),
      activity('a-tp-2', 'Modular Listening Session', 'Thu 19 Jun', '20:00-23:00', 'act-modular', { price: 'Free' }),
    ],
    posts: [post('p-tp-1', 'Studio share in Wedding — 1 desk free', 'Nils B.')],
  }),
  makeCircle({
    id: 'jazz-improv-circle',
    name: 'Jazz & Improv Circle',
    category: 'Music',
    description:
      'Open sessions for jazz musicians and improvisers. Bring your instrument, leave your setlist at home.',
    members: 2110,
    activities: 176,
    faces: [6, 7, 8, 9, 10],
    upcoming: [
      activity('a-jz-1', 'Open Jam Session', 'Sun 08 Jun', '17:00-20:00', 'act-jam', { price: '5€' }),
      activity('a-jz-2', 'Improvisation Workshop', 'Wed 25 Jun', '18:30-21:00', 'act-improv'),
    ],
  }),
  makeCircle({
    id: 'bedroom-producers',
    name: 'Bedroom Producers',
    category: 'Music',
    description:
      'For people making music alone at home — feedback threads, sample swaps and the occasional meetup.',
    members: 6380,
    activities: 430,
    faces: [46, 47, 48, 49, 50],
    upcoming: [
      activity('a-bp-1', 'Feedback Night: Share a Demo', 'Tue 10 Jun', '19:00-21:30', 'act-feedback'),
      activity('a-bp-2', 'Sample Swap Meetup', 'Sat 21 Jun', '14:00-17:00', 'act-sampleswap'),
    ],
    posts: [post('p-bp-1', 'Anyone up for a remix exchange?', 'Pia D.')],
  }),
  makeCircle({
    id: 'vinyl-djs-berlin',
    name: 'Vinyl DJs Berlin',
    category: 'Music',
    description:
      'Crate diggers and selectors who still believe in records — swaps, back-to-back nights and listening bars.',
    members: 3470,
    activities: 255,
    faces: [66, 67, 68, 69, 70],
    upcoming: [
      activity('a-vd-1', 'Record Swap Sunday', 'Sun 15 Jun', '13:00-18:00', 'act-recordswap', { price: 'Free' }),
      activity('a-vd-2', 'B2B Listening Bar', 'Fri 20 Jun', '20:00-00:00', 'act-b2b'),
    ],
  }),

  // ── Dance ──
  makeCircle({
    id: 'contemporary-dance',
    name: 'Contemporary Dance Circle',
    category: 'Dance',
    description:
      'Contemporary movement, improvisation and shared studio time for dancers of every level across Berlin.',
    members: 3120,
    activities: 210,
    faces: [56, 57, 58, 59, 60],
    upcoming: [
      activity('a-cd-1', 'Improvisation Jam', 'Sun 01 Jun', '14:00-17:00', 'act-djam', { price: '10€' }),
      activity('a-cd-2', 'Floorwork Intensive', 'Sat 14 Jun', '10:00-13:00', 'act-floor', { price: '25€' }),
    ],
  }),
  makeCircle({
    id: 'street-dance-berlin',
    name: 'Street Dance Berlin',
    category: 'Dance',
    description:
      'Hip-hop, breaking, house and battles. Cyphers every week — the circle that keeps Berlin street dance moving.',
    members: 5840,
    activities: 318,
    faces: [61, 62, 63, 64, 65],
    upcoming: [
      activity('a-sd-1', 'Weekly Cypher', 'Fri 30 May', '20:00-23:00', 'act-cypher', { price: 'Free' }),
      activity('a-sd-2', 'Breaking Fundamentals Class', 'Tue 10 Jun', '18:00-20:00', 'act-breaking', { price: '8€' }),
    ],
    posts: [post('p-sd-1', 'Crew looking for a 4th member', 'Deniz Y.')],
  }),
  makeCircle({
    id: 'ballet-berlin',
    name: 'Ballet Berlin',
    category: 'Dance',
    description:
      'Open barre, technique classes and repertoire workshops for ballet dancers returning to or staying with the form.',
    members: 1740,
    activities: 132,
    faces: [11, 12, 13, 14, 15],
    upcoming: [
      activity('a-bl-1', 'Open Barre Morning', 'Sat 07 Jun', '09:30-11:00', 'act-barre', { price: '12€' }),
      activity('a-bl-2', 'Repertoire Workshop', 'Sun 22 Jun', '13:00-16:00', 'act-rep'),
    ],
  }),
  makeCircle({
    id: 'voguing-house-berlin',
    name: 'Voguing House Berlin',
    category: 'Dance',
    description:
      'Balls, practice sessions and chosen family — a house for voguers and the ballroom scene in Berlin.',
    members: 2290,
    activities: 188,
    faces: [16, 17, 18, 19, 20],
    upcoming: [
      activity('a-vh-1', 'Practice Session', 'Wed 11 Jun', '19:00-22:00', 'act-practice', { price: 'Free' }),
      activity('a-vh-2', 'Mini Ball: New Talent', 'Sat 28 Jun', '21:00-01:00', 'act-ball', { price: '10€' }),
    ],
    posts: [post('p-vh-1', 'New to voguing? Read this first', 'House Mother')],
  }),

  // ── Art & Design ──
  makeCircle({
    id: 'street-art-berlin',
    name: 'Street Art Berlin',
    category: 'Art & Design',
    description:
      'Walls, paste-ups and legal spots — a circle for muralists, writers and anyone painting the city.',
    members: 8120,
    activities: 540,
    faces: [21, 22, 23, 24, 25],
    upcoming: [
      activity('a-sa-1', 'Legal Wall Paint Day', 'Sat 07 Jun', '11:00-17:00', 'act-wall', { price: 'Free' }),
      activity('a-sa-2', 'Stencil Workshop', 'Thu 19 Jun', '18:00-21:00', 'act-stencil', { price: '15€' }),
    ],
    posts: [post('p-sa-1', 'Spare cans? Donate to the youth project', 'Kemal T.')],
  }),
  makeCircle({
    id: 'illustrators-circle',
    name: 'Illustrators Circle',
    category: 'Art & Design',
    description:
      'Sketch meetups, portfolio nights and client-work survival tips for illustrators of every style.',
    members: 3940,
    activities: 276,
    faces: [26, 27, 28, 29, 30],
    upcoming: [
      activity('a-il-1', 'Life Drawing Evening', 'Tue 03 Jun', '18:30-20:30', 'act-lifedraw', { price: '9€' }),
      activity('a-il-2', 'Portfolio Review Night', 'Wed 18 Jun', '19:00-21:00', 'act-portfolio'),
    ],
  }),
  makeCircle({
    id: 'ceramics-pottery-berlin',
    name: 'Ceramics & Pottery Berlin',
    category: 'Art & Design',
    description:
      'Shared kilns, wheel time and glaze experiments for potters across the city.',
    members: 2660,
    activities: 204,
    faces: [31, 32, 33, 34, 35],
    upcoming: [
      activity('a-ce-1', 'Wheel Throwing for Beginners', 'Sat 14 Jun', '10:00-13:00', 'act-wheel', { price: '35€' }),
      activity('a-ce-2', 'Glaze Test Open Day', 'Sun 29 Jun', '12:00-16:00', 'act-glaze'),
    ],
  }),
  makeCircle({
    id: 'analog-photography-club',
    name: 'Analog Photography Club',
    category: 'Art & Design',
    description:
      'Film photographers and darkroom devotees — photo walks, developing nights and print swaps.',
    members: 4510,
    activities: 322,
    faces: [36, 37, 38, 39, 40],
    upcoming: [
      activity('a-ph-1', 'Sunday Photo Walk: Kreuzberg', 'Sun 08 Jun', '11:00-14:00', 'act-walk', { price: 'Free' }),
      activity('a-ph-2', 'Darkroom Developing Night', 'Thu 26 Jun', '18:00-22:00', 'act-darkroom', { price: '14€' }),
    ],
    posts: [post('p-ph-1', 'Selling a Mamiya RB67 — fair price', 'Greta W.')],
  }),

  // ── Technology & Making ──
  makeCircle({
    id: 'women-in-tech',
    name: 'Women in Tech',
    category: 'Technology & Making',
    description:
      'A circle for women and non-binary people building in tech — mentorship, talks, hack nights and real support.',
    members: 14622,
    activities: 734,
    faces: [1, 2, 3, 4, 5],
    upcoming: [
      activity('a-wit-1', 'Intro to System Design', 'Wed 11 Jun', '18:30-20:30', 'act-system'),
      activity('a-wit-2', 'Portfolio Review Night', 'Tue 17 Jun', '19:00-21:00', 'act-witportfolio', { price: 'Free' }),
    ],
    posts: [post('p-wit-1', 'Hiring: junior frontend dev (Kreuzberg)', 'Sara L.')],
  }),
  makeCircle({
    id: 'nocode-kreuzberg',
    name: 'No-Code Collective Kreuzberg',
    category: 'Technology & Making',
    description:
      'Build products without writing code — tools, templates and weekly co-working for makers and small founders.',
    members: 11622,
    activities: 662,
    faces: [6, 7, 8, 9, 10],
    upcoming: [
      activity('a-nc-1', 'No-Code Co-Working', 'Mon 02 Jun', '10:00-16:00', 'act-cowork'),
      activity('a-nc-2', 'Automations Show & Tell', 'Thu 19 Jun', '19:00-21:00', 'act-automations'),
    ],
  }),
  makeCircle({
    id: 'hardware-hackers-berlin',
    name: 'Berlin Hardware Hackers',
    category: 'Technology & Making',
    description:
      'Soldering irons, dev boards and broken things made interesting again — a circle for makers and tinkerers.',
    members: 5230,
    activities: 388,
    faces: [41, 42, 43, 44, 45],
    upcoming: [
      activity('a-hh-1', 'Repair Café', 'Sat 07 Jun', '12:00-17:00', 'act-repair', { price: 'Free' }),
      activity('a-hh-2', 'Microcontroller Night', 'Wed 25 Jun', '18:30-21:30', 'act-micro'),
    ],
    posts: [post('p-hh-1', 'Free components box — first come', 'Lukas E.')],
  }),
  makeCircle({
    id: 'ai-builders-berlin',
    name: 'AI Builders Berlin',
    category: 'Technology & Making',
    description:
      'Paper readings, demo nights and honest talk about building with AI — hype-free.',
    members: 9870,
    activities: 604,
    faces: [46, 47, 48, 49, 50],
    upcoming: [
      activity('a-ai-1', 'Demo Night: Bring Your Build', 'Tue 10 Jun', '19:00-22:00', 'act-demo', { price: 'Free' }),
      activity('a-ai-2', 'Paper Reading Group', 'Thu 26 Jun', '18:00-20:00', 'act-paper'),
    ],
  }),

  // ── Literature ──
  makeCircle({
    id: 'literature-readers',
    name: 'Literature Readers Berlin',
    category: 'Literature',
    description:
      'A slow, generous reading circle — one book a month, long conversations and a standing invitation to disagree.',
    members: 2240,
    activities: 96,
    faces: [16, 17, 18, 19, 20],
    upcoming: [
      activity('a-lit-1', 'Monthly Book Discussion', 'Thu 05 Jun', '19:00-21:00', 'act-bookclub'),
      activity('a-lit-2', 'Poetry Reading Night', 'Fri 20 Jun', '20:00-22:00', 'act-poetry', { price: '5€' }),
    ],
    posts: [post('p-lit-1', 'June book vote is open', 'Anke P.')],
  }),
  makeCircle({
    id: 'poetry-slam-berlin',
    name: 'Poetry Slam Berlin',
    category: 'Literature',
    description:
      'Open mics, slam workshops and a stage for spoken word in Berlin — beginners always welcome.',
    members: 3180,
    activities: 241,
    faces: [51, 52, 53, 54, 55],
    upcoming: [
      activity('a-ps-1', 'Open Mic Night', 'Fri 06 Jun', '20:00-23:00', 'act-openmic', { price: '6€' }),
      activity('a-ps-2', 'Slam Writing Workshop', 'Sun 22 Jun', '14:00-17:00', 'act-slamwork'),
    ],
    posts: [post('p-ps-1', 'First-time slammers — sign up here', 'Yara N.')],
  }),
  makeCircle({
    id: 'creative-writing-circle',
    name: 'Creative Writing Circle',
    category: 'Literature',
    description:
      'Prompts, workshops and accountability for people writing fiction, essays and everything in between.',
    members: 1920,
    activities: 148,
    faces: [56, 57, 58, 59, 60],
    upcoming: [
      activity('a-cw-1', 'Weekly Writing Sprint', 'Tue 03 Jun', '18:00-20:00', 'act-sprint', { price: 'Free' }),
      activity('a-cw-2', 'Short Story Critique Group', 'Wed 18 Jun', '19:00-21:30', 'act-critique'),
    ],
  }),
];

// ─── Categories ───────────────────────────────────────────────────────────────

export const MOCK_CIRCLE_CATEGORIES: MockCircleCategory[] = [
  {
    id: 'film',
    title: 'Film',
    subtitle: 'Join 24 Film circles across Berlin',
    circleIds: [
      'berlin-film-community',
      'screenwriters-directors',
      'documentary-lovers',
      'scenelab',
      'lgbtqia-film',
      'berlin-cinephiles',
      'experimental-film-lab',
    ],
  },
  {
    id: 'music',
    title: 'Music',
    subtitle: 'Join 29 Music circles across Berlin',
    circleIds: ['techno-producers-berlin', 'jazz-improv-circle', 'bedroom-producers', 'vinyl-djs-berlin'],
  },
  {
    id: 'dance',
    title: 'Dance',
    subtitle: '18 Dance circles from contemporary to street dance',
    circleIds: ['contemporary-dance', 'street-dance-berlin', 'ballet-berlin', 'voguing-house-berlin'],
  },
  {
    id: 'art-design',
    title: 'Art & Design',
    subtitle: '21 Art & Design circles for makers and visual artists',
    circleIds: ['street-art-berlin', 'illustrators-circle', 'ceramics-pottery-berlin', 'analog-photography-club'],
  },
  {
    id: 'technology',
    title: 'Technology & Making',
    subtitle: '31 Circles for builders, coders and makers',
    circleIds: ['women-in-tech', 'nocode-kreuzberg', 'hardware-hackers-berlin', 'ai-builders-berlin'],
  },
  {
    id: 'literature',
    title: 'Literature',
    subtitle: '14 Circles for readers, writers and thinkers',
    circleIds: ['literature-readers', 'poetry-slam-berlin', 'creative-writing-circle'],
  },
];

// ─── Lookups ──────────────────────────────────────────────────────────────────

/** Look up a single mock circle by id. Mirrors getCircleById() in circles.service.ts. */
export function getMockCircleById(id: string): MockCircle | undefined {
  return MOCK_CIRCLES.find((c) => c.id === id);
}

/** Resolve an ordered list of circles from their ids (used by category rows). */
export function getMockCirclesByIds(ids: string[]): MockCircle[] {
  return ids
    .map((id) => getMockCircleById(id))
    .filter((c): c is MockCircle => Boolean(c));
}
