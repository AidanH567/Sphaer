/**
 * scripts/audit-posters.ts
 *
 * Check every event poster that the app actually serves and report the ones
 * that will render as a hole in the Mural.
 *
 *   npx tsx scripts/audit-posters.ts
 *
 * WHY: a poster that downloads fine, returns 200, and decodes fine can still
 * be a fully transparent image. `import-figma-posters.ts` compresses whatever
 * the Figma asset endpoint hands back, and when that endpoint returns an empty
 * render the result is a ~1.5 KB WebP whose alpha channel is entirely zero.
 * Seven of the fifty seeded posters were in exactly that state when the Mural
 * was reported as "lots of blank white screen" — 14% of the wall was literally
 * invisible, and no HTTP check or type would have caught it.
 *
 * Reads with the ANON key only (public bucket + public events), so it needs no
 * service-role credentials — just .env.local's EXPO_PUBLIC_* pair.
 *
 * Exit code 1 if anything is broken, so it can gate a seed run.
 */

import * as dotenv from 'dotenv';
import * as path from 'node:path';
import sharp from 'sharp';

const projectRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env.local') });
dotenv.config({ path: path.join(projectRoot, '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !ANON_KEY) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.local'
  );
}

/** Below this fraction of visible pixels a poster reads as an empty tile. */
const MIN_OPAQUE_FRACTION = 0.05;
/** Below this, a poster is too low-res for a ~400px-wide mural slot. */
const MIN_EDGE_PX = 300;

interface EventRow {
  id: string;
  title: string;
  poster_url: string | null;
}

type Verdict = 'ok' | 'blank' | 'tiny' | 'missing' | 'undecodable';

interface Result {
  id: string;
  title: string;
  slug: string;
  verdict: Verdict;
  detail: string;
}

/** Fraction of sampled pixels that aren't fully transparent. */
async function opaqueFraction(buffer: Buffer): Promise<number> {
  const image = sharp(buffer);
  const meta = await image.metadata();
  if (!meta.hasAlpha) return 1;
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  // Sample every ~53rd pixel — prime-ish stride so we don't land on a
  // repeating pattern, and fast enough for a few hundred posters.
  let opaque = 0;
  let total = 0;
  for (let i = 0; i < data.length; i += info.channels * 53) {
    total += 1;
    if (data[i + 3] > 10) opaque += 1;
  }
  return total === 0 ? 1 : opaque / total;
}

async function inspect(row: EventRow): Promise<Result> {
  const url = row.poster_url as string;
  const slug = url.split('/').pop()?.split('?')[0] ?? url;
  const base = { id: row.id, title: row.title, slug };

  const res = await fetch(url);
  if (!res.ok) {
    return { ...base, verdict: 'missing', detail: `HTTP ${res.status}` };
  }
  const buffer = Buffer.from(await res.arrayBuffer());

  let width = 0;
  let height = 0;
  try {
    const meta = await sharp(buffer).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  } catch (err) {
    return {
      ...base,
      verdict: 'undecodable',
      detail: err instanceof Error ? err.message : 'decode failed',
    };
  }

  const opaque = await opaqueFraction(buffer);
  if (opaque < MIN_OPAQUE_FRACTION) {
    return {
      ...base,
      verdict: 'blank',
      detail: `${(opaque * 100).toFixed(1)}% visible pixels, ${buffer.length} B, ${width}x${height}`,
    };
  }
  if (Math.min(width, height) < MIN_EDGE_PX) {
    return {
      ...base,
      verdict: 'tiny',
      detail: `${width}x${height} — smaller than a mural slot`,
    };
  }
  return { ...base, verdict: 'ok', detail: `${width}x${height}, ${buffer.length} B` };
}

async function main() {
  const query =
    `${SUPABASE_URL}/rest/v1/events` +
    `?select=id,title,poster_url&or=(visibility.is.null,visibility.eq.anyone)`;
  const res = await fetch(query, {
    headers: { apikey: ANON_KEY as string, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to list events: ${res.status} ${res.statusText}`);
  }
  const rows = (await res.json()) as EventRow[];
  const withPosters = rows.filter((r) => !!r.poster_url);

  console.log(
    `Auditing ${withPosters.length} posters (${rows.length - withPosters.length} events have none)…\n`
  );

  const results: Result[] = [];
  for (const row of withPosters) {
    results.push(await inspect(row));
  }

  const broken = results.filter((r) => r.verdict !== 'ok');
  for (const r of broken) {
    console.log(`  ✗ ${r.verdict.toUpperCase().padEnd(12)} ${r.slug}`);
    console.log(`      ${r.title}`);
    console.log(`      ${r.detail}`);
    console.log(`      event ${r.id}`);
  }

  const okCount = results.length - broken.length;
  console.log(`\n${okCount}/${results.length} posters render. ${broken.length} broken.`);
  if (broken.length > 0) {
    console.log(
      '\nFix: replace the poster for each event above (upload a real image and\n' +
        'update its poster_url), then re-run this script.'
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
