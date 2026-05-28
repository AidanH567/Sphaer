/**
 * scripts/seed-demo-data.ts
 *
 * One-time investor-demo seed. Inserts every MOCK_EVENT and MOCK_CIRCLE
 * as a real Supabase row owned by an automatically-provisioned ghost user.
 *
 * After this runs, the app's feed and circles pages — which now query real
 * Supabase data — will be full of vibrant Berlin content out of the box.
 * The investor's own creations sit naturally alongside the seeded rows.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Prerequisites
 * ─────────────────────────────────────────────────────────────────────
 *   1. Run both profile_v2 + activities_v2 migrations in the SQL editor.
 *   2. Add SUPABASE_SERVICE_ROLE_KEY to .env.local — get it from
 *      Supabase dashboard → Settings → API → service_role secret.
 *      NOTE: this key bypasses ALL RLS. NEVER commit it, never put it in
 *      anything under app/ or src/. .env.local is already in .gitignore.
 *   3. Install runner + dotenv if you don't have them:
 *        npm install -D tsx dotenv
 *   4. Run from project root:
 *        npx tsx scripts/seed-demo-data.ts
 *
 * Idempotent — safe to re-run. Ghost users / events / circles are upserted.
 *
 * ─────────────────────────────────────────────────────────────────────
 * How it works
 * ─────────────────────────────────────────────────────────────────────
 *   1. Reads every distinct creator from MOCK_EVENTS (16 hosts).
 *   2. For each, ensures a Supabase Auth user exists at
 *      <handle>@sphaer.demo. Creates with the service role if missing.
 *   3. The handle_new_user trigger inserts the profile row; we then upsert
 *      the rest of the profile fields (display_name, avatar, bio).
 *   4. Inserts each MOCK_EVENT with creator_id remapped to the ghost UUID.
 *      The on_event_created trigger auto-registers the creator.
 *   5. Inserts each MOCK_CIRCLE with creator_id = first ghost.
 *      The on_circle_created trigger auto-admins the creator.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { MOCK_EVENTS } from '../src/data/mockEvents';
import { MOCK_CIRCLES } from '../src/data/mockCircles';
import type { Database } from '../src/types/supabase';

// Load .env.local (Expo convention) first, then fall back to .env.
// dotenv won't overwrite vars that are already set, so .env.local wins.
const projectRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env.local') });
dotenv.config({ path: path.join(projectRoot, '.env') });

// ─── Env / client ────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error(
    `EXPO_PUBLIC_SUPABASE_URL missing. Looked in ${path.join(projectRoot, '.env.local')} and ${path.join(projectRoot, '.env')}.`
  );
}
if (!SERVICE_ROLE_KEY) {
  throw new Error(
    `SUPABASE_SERVICE_ROLE_KEY missing from .env.local. Get from Supabase dashboard → Settings → API → service_role secret.`
  );
}

const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Ghost user provisioning ─────────────────────────────────────────────────

interface ExperienceSpec {
  title: string;
  organisation: string;
  start_date: string;
  end_date: string | null; // null = Present
  description: string;
}

interface GhostSpec {
  mockId: string;       // e.g. 'host-tarkovsky' — matches MOCK_EVENTS creator_id
  email: string;        // e.g. 'tarkovsky@sphaer.demo'
  displayName: string;
  username: string;
  avatarUrl: string;
  bio: string;          // short tagline
  about: string;        // longer paragraph
  disciplines: string[];
  neighborhood: string;
  experiences: ExperienceSpec[];
}

/**
 * Hand-curated ghost profiles for the demo. Each mockId matches a creator_id
 * in src/data/mockEvents.ts so seeding events later can map creators by id.
 * Bios are deliberately specific so /user/<ghost> pages feel real, not
 * template-filled.
 */
const GHOST_SPECS: GhostSpec[] = [
  {
    mockId: 'host-tarkovsky',
    email: 'tarkovsky@sphaer.demo',
    displayName: 'Camille Laurent',
    username: 'camille.laurent',
    avatarUrl: 'https://i.pravatar.cc/300?img=32',
    bio: 'Film theory, slow cinema, and the long shot',
    about:
      "I teach and write about post-war European cinema, with a special focus on Tarkovsky, Antonioni, and the slow cinema movement. Online lectures and reading groups are open to anyone who'd rather watch four films in twelve hours than scroll for the same time.",
    disciplines: ['Film', 'Education', 'Talk'],
    neighborhood: 'Friedrichshain',
    experiences: [
      {
        title: 'Visiting Lecturer',
        organisation: 'Deutsche Film- und Fernsehakademie',
        start_date: '2021-09',
        end_date: null,
        description: 'Seminars on long-take aesthetics and post-war European cinema.',
      },
      {
        title: 'Programme Editor',
        organisation: 'Arsenal Institute for Film',
        start_date: '2018-01',
        end_date: '2021-08',
        description: 'Curated repertory series and wrote programme notes.',
      },
    ],
  },
  {
    mockId: 'host-ceramic',
    email: 'ceramic@sphaer.demo',
    displayName: 'Lena Hoffmann',
    username: 'lena.ceramics',
    avatarUrl: 'https://i.pravatar.cc/300?img=45',
    bio: 'Ceramics, slowness, and the texture of clay',
    about:
      'I work in stoneware out of a shared studio in Wedding. My workshops are about the unhurried part — wedging, throwing, the listening kind of attention you need to feel when a wall is ready. Beginners welcome.',
    disciplines: ['Art', 'Workshop'],
    neighborhood: 'Wedding',
    experiences: [
      {
        title: 'Studio Ceramicist',
        organisation: 'Lehmwerk Berlin',
        start_date: '2020-03',
        end_date: null,
        description: 'Wheel-throwing, hand-building workshops, small-batch tableware.',
      },
    ],
  },
  {
    mockId: 'host-eurorack',
    email: 'eurorack@sphaer.demo',
    displayName: 'Eric Abraham',
    username: 'eric.abraham',
    avatarUrl: 'https://i.pravatar.cc/300?img=12',
    bio: 'Modular synthesis, soldering, and patch as conversation',
    about:
      "I run modular synth meetups across Berlin and occasionally teach intro classes. Currently building a hardware oscillator that I'll probably never finish.",
    disciplines: ['Music', 'Workshop', 'Concert'],
    neighborhood: 'Neukölln',
    experiences: [
      {
        title: 'Instructor',
        organisation: 'Modular Berlin Collective',
        start_date: '2019-06',
        end_date: null,
        description: 'Intro workshops on Eurorack patching and modular voice design.',
      },
      {
        title: 'Live Performer',
        organisation: 'Various venues',
        start_date: '2017-01',
        end_date: null,
        description: 'Improvised modular sets at OHM, Hopscotch, and Watergate.',
      },
    ],
  },
  {
    mockId: 'host-jassmom',
    email: 'jassmom@sphaer.demo',
    displayName: 'Marcus Veil',
    username: 'marcus.veil',
    avatarUrl: 'https://i.pravatar.cc/300?img=60',
    bio: 'Free jazz pianist, improviser, listener',
    about:
      "I run the JASSMOM nights — quiet, attentive evenings for improvisers who'd rather listen than be heard. Trio bookings welcome through the website.",
    disciplines: ['Music', 'Concert'],
    neighborhood: 'Kreuzberg',
    experiences: [
      {
        title: 'Co-curator, JASSMOM',
        organisation: 'Au Topsi Pohl',
        start_date: '2022-09',
        end_date: null,
        description: 'Monthly improvised music night.',
      },
    ],
  },
  {
    mockId: 'host-poetry',
    email: 'poetry@sphaer.demo',
    displayName: 'Yara Nouri',
    username: 'yara.nouri',
    avatarUrl: 'https://i.pravatar.cc/300?img=47',
    bio: 'Spoken word, multilingual poetics, slam organising',
    about:
      'Berlin-based poet writing in Farsi, German, and English. I host the open mic at Brunnen70 and run an irregular workshop on writing under censorship.',
    disciplines: ['Art', 'Talk', 'Workshop'],
    neighborhood: 'Mitte',
    experiences: [
      {
        title: 'Host, Berlin Poetry Slam',
        organisation: 'Brunnen70',
        start_date: '2020-04',
        end_date: null,
        description: 'Monthly open mic + featured-poet readings.',
      },
    ],
  },
  {
    mockId: 'host-techno',
    email: 'techno@sphaer.demo',
    displayName: 'Nils Brandt',
    username: 'nils.brandt',
    avatarUrl: 'https://i.pravatar.cc/300?img=15',
    bio: 'DJ, modular techno, ear-first listening culture',
    about:
      'I make long-form modular techno and host listening evenings in Wedding for people who think club volumes wreck nuance. Recent residencies at OHM and ://about blank.',
    disciplines: ['Music', 'Concert'],
    neighborhood: 'Wedding',
    experiences: [
      {
        title: 'Resident DJ',
        organisation: 'OHM Berlin',
        start_date: '2021-11',
        end_date: null,
        description: 'Monthly slot.',
      },
    ],
  },
  {
    mockId: 'host-yoga',
    email: 'yoga@sphaer.demo',
    displayName: 'Sofia Reyes',
    username: 'sofia.reyes',
    avatarUrl: 'https://i.pravatar.cc/300?img=20',
    bio: 'Yoga teacher, breathwork facilitator, Treptower regular',
    about:
      'I teach Hatha and breathwork in parks across Berlin from late spring through early autumn. Studio classes at Yogibar Kreuzberg through the winter. Everyone-welcome pace.',
    disciplines: ['Wellness', 'Coach', 'Workshop'],
    neighborhood: 'Treptow',
    experiences: [
      {
        title: 'Yoga Teacher',
        organisation: 'Yogibar Berlin',
        start_date: '2019-01',
        end_date: null,
        description: 'Hatha, breathwork, occasional workshops.',
      },
    ],
  },
  {
    mockId: 'host-photo',
    email: 'photo@sphaer.demo',
    displayName: 'Greta Wolf',
    username: 'greta.wolf',
    avatarUrl: 'https://i.pravatar.cc/300?img=38',
    bio: 'Analog photography, street walks, darkroom prints',
    about:
      'I shoot mostly on a Leica M6 and run beginner-friendly photo walks through Kreuzberg and Mitte. Darkroom workshops every other Sunday at Spinnerei.',
    disciplines: ['Art', 'Workshop'],
    neighborhood: 'Kreuzberg',
    experiences: [
      {
        title: 'Darkroom Instructor',
        organisation: 'Spinnerei Berlin',
        start_date: '2020-09',
        end_date: null,
        description: 'B&W developing and printing for beginners.',
      },
    ],
  },
  {
    mockId: 'host-jobfair',
    email: 'jobfair@sphaer.demo',
    displayName: 'Berlin Creative Network',
    username: 'berlin.creative',
    avatarUrl: 'https://i.pravatar.cc/300?img=51',
    bio: 'Hiring + showcasing the Berlin creative industry',
    about:
      'We connect studios, agencies, and independent creatives with the people who want to work with them. Job fair every spring + autumn, plus year-round portfolio reviews.',
    disciplines: ['Job', 'Meet'],
    neighborhood: 'Mitte',
    experiences: [
      {
        title: 'Organising Collective',
        organisation: 'Berlin Creative Network',
        start_date: '2018-04',
        end_date: null,
        description: 'Job fairs, portfolio reviews, mentorship.',
      },
    ],
  },
  {
    mockId: 'host-painting',
    email: 'painting@sphaer.demo',
    displayName: 'Paul Adler',
    username: 'paul.adler',
    avatarUrl: 'https://i.pravatar.cc/300?img=13',
    bio: 'Oil painter, life drawing, slow looking',
    about:
      "I paint figuratively out of an atelier in Schöneberg. Run an evening life drawing class for anyone who hasn't held charcoal since school.",
    disciplines: ['Art', 'Workshop', 'Education'],
    neighborhood: 'Schöneberg',
    experiences: [
      {
        title: 'Studio Painter & Tutor',
        organisation: 'Atelier Adler',
        start_date: '2016-02',
        end_date: null,
        description: 'Life drawing classes and private commissions.',
      },
    ],
  },
  {
    mockId: 'host-startup',
    email: 'startup@sphaer.demo',
    displayName: 'Sara Lindqvist',
    username: 'sara.lindqvist',
    avatarUrl: 'https://i.pravatar.cc/300?img=5',
    bio: 'Solo founder, build-in-public advocate, mentor',
    about:
      'Building a small SaaS in Berlin. Run a monthly meetup for early founders who want frank conversation, not pitch decks. Also mentor through Female Founders.',
    disciplines: ['Job', 'Meet', 'Talk'],
    neighborhood: 'Prenzlauer Berg',
    experiences: [
      {
        title: 'Founder',
        organisation: 'Stealth (early stage)',
        start_date: '2023-06',
        end_date: null,
        description: 'Solo SaaS, building publicly.',
      },
      {
        title: 'Product Lead',
        organisation: 'N26',
        start_date: '2020-01',
        end_date: '2023-05',
        description: 'Onboarding and identity squad.',
      },
    ],
  },
  {
    mockId: 'host-dance',
    email: 'dance@sphaer.demo',
    displayName: 'Mara Conti',
    username: 'mara.conti',
    avatarUrl: 'https://i.pravatar.cc/300?img=24',
    bio: 'Contemporary dancer, release-based teacher',
    about:
      'Trained in Florence, based in Berlin since 2019. Teach an open class on Saturdays at Acker Stadt Palast — release technique, improvisation, slow warm-ups.',
    disciplines: ['Art', 'Workshop', 'Wellness'],
    neighborhood: 'Mitte',
    experiences: [
      {
        title: 'Open Class Teacher',
        organisation: 'Acker Stadt Palast',
        start_date: '2021-09',
        end_date: null,
        description: 'Weekly contemporary dance class.',
      },
    ],
  },
  {
    mockId: 'host-film2',
    email: 'film2@sphaer.demo',
    displayName: 'Theo Marchand',
    username: 'theo.marchand',
    avatarUrl: 'https://i.pravatar.cc/300?img=33',
    bio: 'Programmer, short film evangelist, projectionist',
    about:
      'I curate the Berlin Shorts open-air programme every August at Mauerpark and write occasionally for Sight & Sound. Always looking for short film submissions.',
    disciplines: ['Film', 'Talk', 'Concert'],
    neighborhood: 'Prenzlauer Berg',
    experiences: [
      {
        title: 'Programmer',
        organisation: 'Berlin Shorts Festival',
        start_date: '2019-08',
        end_date: null,
        description: 'Annual outdoor short film festival.',
      },
    ],
  },
  {
    mockId: 'host-cooking',
    email: 'cooking@sphaer.demo',
    displayName: 'Deniz Yilmaz',
    username: 'deniz.yilmaz',
    avatarUrl: 'https://i.pravatar.cc/300?img=52',
    bio: 'Chef, Anatolian home cooking, supper clubs',
    about:
      "I host monthly supper clubs cooking through the recipes my mother taught me and the regional ones I'm still learning. Eight seats per dinner. Vegetarian options always.",
    disciplines: ['Workshop', 'Meet'],
    neighborhood: 'Neukölln',
    experiences: [
      {
        title: 'Chef & Host',
        organisation: 'Sofra Supper Club',
        start_date: '2022-04',
        end_date: null,
        description: 'Monthly Anatolian-themed dinners.',
      },
    ],
  },
  {
    mockId: 'host-soundbath',
    email: 'soundbath@sphaer.demo',
    displayName: 'Anke Peters',
    username: 'anke.peters',
    avatarUrl: 'https://i.pravatar.cc/300?img=44',
    bio: 'Sound bath facilitator, gong, singing bowls',
    about:
      'I run weekly sound bath evenings in Kreuzberg with a small ensemble of singing bowls, gongs, and koshi chimes. 90 minutes, low light, no spiritual sales pitch.',
    disciplines: ['Wellness', 'Therapy', 'Workshop'],
    neighborhood: 'Kreuzberg',
    experiences: [
      {
        title: 'Facilitator',
        organisation: 'Klang Kollektiv Berlin',
        start_date: '2020-11',
        end_date: null,
        description: 'Weekly sound baths and breathwork sessions.',
      },
    ],
  },
  {
    mockId: 'host-coding',
    email: 'coding@sphaer.demo',
    displayName: 'Robin Aldous',
    username: 'robin.aldous',
    avatarUrl: 'https://i.pravatar.cc/300?img=68',
    bio: 'Creative coder, p5.js teacher, generative art',
    about:
      'I teach intro creative coding workshops with p5.js and Processing — for designers and artists who want to make tools instead of buy them. Also work on data-driven art commissions.',
    disciplines: ['Art', 'Workshop', 'Education'],
    neighborhood: 'Friedrichshain',
    experiences: [
      {
        title: 'Workshop Lead',
        organisation: 'Codestream Berlin',
        start_date: '2021-03',
        end_date: null,
        description: 'Creative coding intro classes for artists & designers.',
      },
    ],
  },
];

function buildGhostSpecs(): GhostSpec[] {
  return GHOST_SPECS;
}

/**
 * Find a user by email by paging through auth.admin.listUsers().
 * Supabase doesn't expose a single getUserByEmail endpoint.
 */
async function findGhostByEmail(email: string): Promise<string | null> {
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found.id;
    if (data.users.length < 1000) return null;
    page += 1;
  }
}

async function ensureGhost(spec: GhostSpec): Promise<string> {
  // Try to create. If conflict (user exists), look them up.
  const { data, error } = await supabase.auth.admin.createUser({
    email: spec.email,
    password: cryptoRandomString(32),
    email_confirm: true,
    user_metadata: { display_name: spec.displayName },
  });

  if (data?.user) return data.user.id;

  // Already exists? Fetch
  if (error?.message?.toLowerCase().includes('already')) {
    const existing = await findGhostByEmail(spec.email);
    if (existing) return existing;
  }
  throw error ?? new Error(`Could not provision ghost ${spec.email}`);
}

function cryptoRandomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * Deterministically map a friendly mock ID like 'evt-tarkovsky' to a stable
 * UUID-formatted string. Postgres accepts any 36-char hex-formatted string
 * for the UUID type; this is not a true RFC 4122 v5 UUID but it's stable,
 * unique, and lets us keep the readable mock IDs as the source of truth.
 *
 * Same input → same output, so the script is idempotent (upsert on id works).
 */
function mockIdToUuid(mockId: string): string {
  const hash = createHash('sha256').update(`sphaer-mock:${mockId}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('▶ Seeding Sphaer demo data');
  console.log(`  Supabase URL: ${SUPABASE_URL}`);

  // 1. Build ghost specs from mock events
  const ghostSpecs = buildGhostSpecs();
  console.log(`▶ Provisioning ${ghostSpecs.length} ghost users…`);

  const ghostUuidByMockId = new Map<string, string>();
  for (const spec of ghostSpecs) {
    const uuid = await ensureGhost(spec);
    ghostUuidByMockId.set(spec.mockId, uuid);
    process.stdout.write(`  ✓ ${spec.displayName.padEnd(28)} (${spec.email})\n`);
  }

  // 2. Upsert profile rows (display_name set by trigger; we fill the rest).
  //    Includes the rich bio/about/disciplines/experiences/neighborhood so
  //    /user/<ghost-id> pages render full content instead of empty sections.
  console.log('▶ Updating ghost profiles…');
  for (const spec of ghostSpecs) {
    const uuid = ghostUuidByMockId.get(spec.mockId)!;
    // Experiences need stable ids — generate one per entry, deterministic per
    // ghost so re-runs don't duplicate.
    const experiences = spec.experiences.map((exp, i) => ({
      id: mockIdToUuid(`${spec.mockId}-exp-${i}`),
      title: exp.title,
      organisation: exp.organisation,
      start_date: exp.start_date,
      end_date: exp.end_date,
      description: exp.description,
    }));

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: spec.displayName,
        username: spec.username,
        avatar_url: spec.avatarUrl,
        bio: spec.bio,
        about: spec.about,
        disciplines: spec.disciplines,
        neighborhood: spec.neighborhood,
        experiences,
        location: 'Berlin',
      })
      .eq('id', uuid);
    if (error) console.warn(`  ⚠ profile update for ${spec.email}: ${error.message}`);
  }

  // 3. Insert events
  console.log(`▶ Inserting ${MOCK_EVENTS.length} events…`);
  let eventOk = 0;
  let eventSkip = 0;
  for (const mock of MOCK_EVENTS) {
    const creatorUuid = ghostUuidByMockId.get(mock.creator_id);
    if (!creatorUuid) {
      console.warn(`  ⚠ skip event ${mock.id}: no creator mapping for ${mock.creator_id}`);
      eventSkip += 1;
      continue;
    }
    const { error } = await supabase.from('events').upsert(
      {
        id: mockIdToUuid(mock.id),
        creator_id: creatorUuid,
        circle_id: null,
        title: mock.title,
        description: mock.description ?? null,
        location_name: mock.location_name ?? null,
        address: mock.address ?? null,
        lat: mock.lat ?? null,
        lng: mock.lng ?? null,
        starts_at: mock.starts_at,
        ends_at: mock.ends_at ?? null,
        categories: mock.categories ?? [],
        poster_url: mock.poster_url ?? null,
        ticket_url: mock.ticket_url ?? null,
        is_free: mock.is_free,
        price: mock.price ?? null,
      },
      { onConflict: 'id' }
    );
    if (error) {
      console.warn(`  ⚠ event "${mock.title}" → ${error.message}`);
      eventSkip += 1;
    } else {
      eventOk += 1;
    }
  }

  // 4. Insert circles — distribute creator_id across ghosts round-robin
  const ghostUuids = Array.from(ghostUuidByMockId.values());
  console.log(`▶ Inserting ${MOCK_CIRCLES.length} circles…`);
  let circleOk = 0;
  let circleSkip = 0;
  for (let i = 0; i < MOCK_CIRCLES.length; i++) {
    const mock = MOCK_CIRCLES[i];
    const creatorUuid = ghostUuids[i % ghostUuids.length];
    const tags = mock.category ? [mock.category] : [];

    const { error } = await supabase.from('circles').upsert(
      {
        id: mockIdToUuid(mock.id),
        creator_id: creatorUuid,
        name: mock.name,
        description: mock.description ?? null,
        avatar_url: mock.avatar_url ?? null,
        cover_url: mock.cover_url ?? null,
        tags,
        is_public: true,
      },
      { onConflict: 'id' }
    );
    if (error) {
      console.warn(`  ⚠ circle "${mock.name}" → ${error.message}`);
      circleSkip += 1;
    } else {
      circleOk += 1;
    }
  }

  console.log('');
  console.log('────────────────────────────────────────');
  console.log(`✅ Seeded:`);
  console.log(`   ${ghostSpecs.length} ghost users`);
  console.log(`   ${eventOk} events  (${eventSkip} skipped)`);
  console.log(`   ${circleOk} circles (${circleSkip} skipped)`);
  console.log('────────────────────────────────────────');
  console.log('Triggers should have auto-registered creators on events');
  console.log('and auto-admined creators on circles. Reload your app to see them.');
}

main().catch((e) => {
  console.error('❌ Seed failed:');
  console.error(e);
  process.exit(1);
});
