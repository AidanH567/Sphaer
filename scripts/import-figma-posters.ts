/**
 * scripts/import-figma-posters.ts
 *
 * One-time importer for designer-curated event posters from the Figma file
 * `HIVq6Vaymj01dZ37AvwCUF` (Sphaer_Prototype_RA).
 *
 * The mapping below was derived by reading the Mural_V2 / FMM component
 * (node-id 3419:10775) via the Figma MCP. Each Figma poster was paired with
 * a MOCK_EVENT by category alignment (Film → Tarkovsky, Music → JASSMOM,
 * etc.) so the posters feel authored, not random.
 *
 * Runs in two steps:
 *   1. Download each Figma asset (PNG) from the public MCP asset URL.
 *   2. Upload to Supabase Storage at `event-posters/figma-seed/<evt-id>.png`
 *      using the service-role key (same .env.local convention as
 *      seed-demo-data.ts).
 *
 * Prints a TypeScript-paste-ready mapping at the end. After running, update
 * the `poster_url` fields in `src/data/mockEvents.ts` and re-run
 * `npx tsx scripts/seed-demo-data.ts` so the DB rows pick up the new URLs.
 *
 *   npx tsx scripts/import-figma-posters.ts
 *
 * Idempotent — re-running just re-uploads with `upsert: true`. Cheap.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'node:path';
import * as fs from 'node:fs';

// Load env the same way seed-demo-data.ts does.
const projectRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env.local') });
dotenv.config({ path: path.join(projectRoot, '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local'
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKET = 'event-posters';
const PREFIX = 'figma-seed';

// ─── Mapping ────────────────────────────────────────────────────────────────
//
// Each entry: { eventId, figmaAssetUuid, designerSource }
// `designerSource` is the Figma layer name — kept here so a future audit can
// trace each poster back to its origin without re-reading Figma.

interface PosterMapping {
  eventId: string;
  figmaAssetUuid: string;
  designerSource: string;
}

const POSTER_MAPPINGS: PosterMapping[] = [
  // NOTE: imgPoster (5d413794) is a 256x256 low-res placeholder in the Figma
  // file — the "real" Ceramic Art image is imgPoster1 (fff79c70), which is
  // why evt-ceramic uses that one and the imgPoster placeholder isn't
  // imported. evt-startup keeps its picsum URL until the designer adds a
  // 16th poster to the Figma file.
  {
    eventId: 'evt-ceramic',
    figmaAssetUuid: 'fff79c70-3336-4c77-90de-444805beacf1',
    designerSource: 'Ceramic Art canonical fill (imgPoster1)',
  },
  {
    eventId: 'evt-painting',
    figmaAssetUuid: 'e4dbb4e1-59ae-486f-9460-f043ec37eae9',
    designerSource: 'Talk: The Healing Process (imgPoster2)',
  },
  {
    eventId: 'evt-coding',
    figmaAssetUuid: '8956b4e6-58e0-4f0f-ae77-cf0767e0b3af',
    designerSource: 'Berlin Hackers Network (imgPoster3)',
  },
  {
    eventId: 'evt-cooking',
    figmaAssetUuid: '783c9faf-d887-48b8-b8fc-435ac57ebea9',
    designerSource: 'Terra Glow Ceramics (imgPoster4)',
  },
  {
    eventId: 'evt-tarkovsky',
    figmaAssetUuid: 'c8777143-7faa-4a3b-b9e4-bab7f586988f',
    designerSource: 'Andrei Tarkovsky Online Session (imgPoster5)',
  },
  {
    eventId: 'evt-poetry',
    figmaAssetUuid: '4286058e-8d59-4110-922d-5622084bebd3',
    designerSource: 'Missing String of Typography Session 31 (imgPoster6)',
  },
  {
    eventId: 'evt-jassmom',
    figmaAssetUuid: '65a5da3b-747a-476e-ad43-10072420d7c6',
    designerSource: 'JASSMOM (imgPoster7)',
  },
  {
    eventId: 'evt-eurorack',
    figmaAssetUuid: '66ed73bf-8a97-426a-af9f-f664c02dbdc6',
    designerSource: 'Analogue Heave (imgPoster8)',
  },
  {
    eventId: 'evt-photo',
    figmaAssetUuid: '355277cf-29f8-4032-99e1-eeb228152087',
    designerSource: 'Ink Meets Idea: Typography Playground (imgPoster9)',
  },
  {
    eventId: 'evt-film2',
    figmaAssetUuid: '8c5f8ec7-7b01-4961-a549-38dcb821ecfe',
    designerSource: 'Film Screening: Fire of Love (imgPoster10)',
  },
  {
    eventId: 'evt-jobfair',
    figmaAssetUuid: '2894df87-e49e-4afd-aeac-8fa02478f632',
    designerSource: 'Working on a Film Set: Workshop (imgPoster11)',
  },
  {
    eventId: 'evt-dance',
    figmaAssetUuid: '9df4fead-a61c-473a-acb8-b68ddd0ed76e',
    designerSource: 'The Typography Experiment Workshop (imgPoster12)',
  },
  {
    eventId: 'evt-soundbath',
    figmaAssetUuid: '3903d7a0-1325-4e7f-b185-66b3ed97bd0e',
    designerSource: 'Volume 3 JASSMOM Improvisation (imgPoster13)',
  },
  {
    eventId: 'evt-techno',
    figmaAssetUuid: '156f0b23-0918-4cf9-a461-a14de5807754',
    designerSource: 'Build A Modular Synthesizer For Kids (imgPoster14)',
  },
  {
    eventId: 'evt-yoga',
    figmaAssetUuid: 'd33385b1-c263-429f-829c-2ebcf54fae57',
    designerSource: 'Inhale//Exhale Morning Yoga (imgPoster15)',
  },
  // evt-startup intentionally not listed — see note at top of array.
];

const FIGMA_ASSET_BASE = 'https://www.figma.com/api/mcp/asset/';

async function downloadFigmaAsset(uuid: string): Promise<Buffer> {
  const res = await fetch(`${FIGMA_ASSET_BASE}${uuid}`);
  if (!res.ok) {
    throw new Error(`Figma asset fetch failed (${uuid}): ${res.status} ${res.statusText}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function uploadPoster(
  eventId: string,
  bytes: Buffer
): Promise<string> {
  const objectPath = `${PREFIX}/${eventId}.png`;
  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, bytes, {
    contentType: 'image/png',
    upsert: true,
    cacheControl: '31536000', // 1 year — these are stable seed assets
  });
  if (error) {
    throw new Error(`Upload failed for ${eventId}: ${error.message}`);
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

async function main() {
  console.log(`Importing ${POSTER_MAPPINGS.length} Figma posters → Supabase Storage`);

  // Local cache directory so we don't re-download on dev iteration.
  const cacheDir = path.join(projectRoot, '.tmp', 'figma-posters');
  fs.mkdirSync(cacheDir, { recursive: true });

  const results: Record<string, string> = {};
  for (const mapping of POSTER_MAPPINGS) {
    const cachePath = path.join(cacheDir, `${mapping.figmaAssetUuid}.png`);
    let bytes: Buffer;

    if (fs.existsSync(cachePath)) {
      bytes = fs.readFileSync(cachePath);
      console.log(`  ${mapping.eventId} ← cached`);
    } else {
      bytes = await downloadFigmaAsset(mapping.figmaAssetUuid);
      fs.writeFileSync(cachePath, bytes);
      console.log(`  ${mapping.eventId} ← downloaded (${bytes.length} bytes)`);
    }

    const publicUrl = await uploadPoster(mapping.eventId, bytes);
    results[mapping.eventId] = publicUrl;
    console.log(`  ${mapping.eventId} → ${publicUrl}`);
  }

  // Emit a paste-ready mapping for mockEvents.ts.
  console.log('\n─── Paste into mockEvents.ts ───\n');
  console.log('const FIGMA_POSTERS: Record<string, string> = {');
  for (const [eventId, url] of Object.entries(results)) {
    console.log(`  '${eventId}': '${url}',`);
  }
  console.log('};');

  // Also dump to a JSON file for the seed step to read.
  const outPath = path.join(projectRoot, '.tmp', 'figma-poster-urls.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
