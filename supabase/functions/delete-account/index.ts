// Supabase Edge Function — DELETE the calling user's account.
//
// Flow:
//   1. Verify the caller's JWT by calling auth.getUser() with a user-scoped client.
//   2. Best-effort clean up storage objects the user owns (avatars, gallery,
//      posters on events they created, circle images on circles they created).
//      Storage failures DO NOT abort — orphans can be swept later; what matters
//      is the auth row + DB rows are gone.
//   3. Call admin.deleteUser(userId) with the service role.
//      The schema's `profiles.id REFERENCES auth.users(id) ON DELETE CASCADE` +
//      every downstream FK being `ON DELETE CASCADE` means a single auth delete
//      cascades through profiles → events → event_registrations → event_message_reads
//      → saved_events → follows → circles → circle_members → circle_follows →
//      circle_message_reads → messages → direct_message_reads → notifications →
//      profile_images. We rely on the DB's referential cascade rather than
//      issuing N explicit deletes — fewer round-trips, less to keep in sync.
//
// Deploy:
//   supabase functions deploy delete-account
// Required env (set via dashboard or `supabase secrets set`):
//   SUPABASE_URL              — auto-provided in edge runtime
//   SUPABASE_ANON_KEY         — auto-provided in edge runtime
//   SUPABASE_SERVICE_ROLE_KEY — must be set; default-injected as
//                                SUPABASE_SERVICE_ROLE_KEY in the runtime.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return jsonError('Method not allowed', 405);
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!jwt) return jsonError('Missing Authorization bearer token', 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return jsonError('Server misconfigured: missing Supabase env', 500);
    }

    // User-scoped client purely to verify the JWT and resolve the user id.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user?.id) {
      return jsonError('Invalid or expired session', 401);
    }
    const userId = userData.user.id;

    // Admin client for storage + admin API deletion.
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    await cleanupStorage(admin, userId);

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error('[delete-account] admin.deleteUser failed', deleteError);
      return jsonError(
        `Account deletion failed: ${deleteError.message}`,
        500,
      );
    }

    return new Response(JSON.stringify({ success: true, userId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: unknown) {
    console.error('[delete-account] unexpected error', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return jsonError(msg, 500);
  }
});

function jsonError(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function cleanupStorage(admin: SupabaseClient, userId: string) {
  // Avatars: `<userId>/avatar.<ext>` — list & remove every object under the prefix.
  await removeAllUnderPrefix(admin, 'avatars', userId);

  // Gallery: `<userId>/<filename>` — same pattern.
  await removeAllUnderPrefix(admin, 'profile-gallery', userId);

  // Event posters: stored under `<eventId>/...` (no userId in path).
  // Pull event posters the user owns BEFORE the cascade fires.
  try {
    const { data: events } = await admin
      .from('events')
      .select('id, poster_url')
      .eq('creator_id', userId);
    const paths = (events ?? [])
      .map((e: { poster_url: string | null }) =>
        extractStoragePath(e.poster_url ?? '', 'event-posters'),
      )
      .filter((p): p is string => !!p);
    if (paths.length) {
      await admin.storage.from('event-posters').remove(paths).catch(() => {});
    }
  } catch (err) {
    console.warn('[delete-account] event poster cleanup failed', err);
  }

  // Circle images (avatar + cover) for circles the user created.
  try {
    const { data: circles } = await admin
      .from('circles')
      .select('id, avatar_url, cover_url')
      .eq('creator_id', userId);
    const paths: string[] = [];
    for (const c of circles ?? []) {
      const a = extractStoragePath(c.avatar_url ?? '', 'circle-images');
      const v = extractStoragePath(c.cover_url ?? '', 'circle-images');
      if (a) paths.push(a);
      if (v) paths.push(v);
    }
    if (paths.length) {
      await admin.storage.from('circle-images').remove(paths).catch(() => {});
    }
  } catch (err) {
    console.warn('[delete-account] circle image cleanup failed', err);
  }
}

async function removeAllUnderPrefix(
  admin: SupabaseClient,
  bucket: string,
  prefix: string,
) {
  try {
    const { data: files } = await admin.storage
      .from(bucket)
      .list(prefix, { limit: 1000 });
    if (!files || files.length === 0) return;
    const paths = files.map((f) => `${prefix}/${f.name}`);
    await admin.storage.from(bucket).remove(paths).catch(() => {});
  } catch (err) {
    console.warn(
      `[delete-account] storage prefix cleanup failed: ${bucket}/${prefix}`,
      err,
    );
  }
}

function extractStoragePath(publicUrl: string, bucket: string): string | null {
  // Public URLs look like:
  //   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>?v=…
  // We want just the <path> portion, stripped of any cache-bust query.
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  const rest = publicUrl.slice(idx + marker.length);
  const q = rest.indexOf('?');
  return q === -1 ? rest : rest.slice(0, q);
}
