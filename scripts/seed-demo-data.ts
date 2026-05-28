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

interface GhostSpec {
  mockId: string;       // e.g. 'host-tarkovsky'
  email: string;        // e.g. 'tarkovsky@sphaer.demo'
  displayName: string;  // e.g. 'Camille Laurent'
  avatarUrl: string;
  username: string;     // e.g. 'camille.laurent'
}

function buildGhostSpecs(): GhostSpec[] {
  const seen = new Map<string, GhostSpec>();
  for (const event of MOCK_EVENTS) {
    if (!event.creator || !event.creator_id) continue;
    if (seen.has(event.creator_id)) continue;
    const handle = event.creator_id.replace(/^host-/, '');
    seen.set(event.creator_id, {
      mockId: event.creator_id,
      email: `${handle}@sphaer.demo`,
      displayName: event.creator.display_name ?? 'Sphaer Demo',
      avatarUrl: event.creator.avatar_url ?? '',
      username: event.creator.username ?? handle,
    });
  }
  return Array.from(seen.values());
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

  // 2. Upsert profile rows (display_name set by trigger; we fill the rest)
  console.log('▶ Updating ghost profiles…');
  for (const spec of ghostSpecs) {
    const uuid = ghostUuidByMockId.get(spec.mockId)!;
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: spec.displayName,
        username: spec.username,
        avatar_url: spec.avatarUrl,
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
