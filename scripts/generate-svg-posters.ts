/**
 * scripts/generate-svg-posters.ts
 *
 * Generates ~10 typography-driven SVG event posters, renders each to PNG
 * via sharp, uploads to Supabase Storage at
 *   event-posters/figma-seed/<evt-id>.png
 * and writes a JSON map of slug → public URL for use in mockEvents.ts.
 *
 * Designs are mixed: bold-typography-on-color, gradient, geometric, and
 * two-color accent — matching the Berlin design aesthetic (Studio 8,
 * Type Craft, Das Plakat) the user references called out.
 *
 * Idempotent: re-running just re-renders + re-uploads (Supabase upsert).
 *
 *   npx tsx scripts/generate-svg-posters.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';

const projectRoot = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(projectRoot, '.env.local') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase env vars in .env.local');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const BUCKET = 'event-posters';
const PREFIX = 'figma-seed';

// ─── Designs ────────────────────────────────────────────────────────────────
// Each poster is rendered at 800×1133 (A4-ish portrait at 96 DPI) and
// served as PNG. The svg() function for each design draws everything via
// SVG primitives — no external fonts. Uses system-safe fallbacks (Helvetica,
// Georgia, Courier) so the rendered PNG is consistent across environments.

interface PosterDesign {
  slug: string; // becomes evt-<slug>
  title: string;
  subtitle: string;
  meta: string; // date/venue line
  svg: () => string;
}

const W = 800;
const H = 1133;

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Helvetica-stack big bold sans-serif on a solid colour
function bigType(opts: {
  bg: string;
  fg: string;
  accent?: string;
  title: string;
  subtitle: string;
  meta: string;
}): string {
  const { bg, fg, accent, title, subtitle, meta } = opts;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  ${accent ? `<rect x="60" y="800" width="180" height="14" fill="${accent}"/>` : ''}
  <text x="60" y="200" font-family="Helvetica, Arial, sans-serif" font-weight="900" font-size="120" fill="${fg}" letter-spacing="-4">${escape(title.split(' ')[0])}</text>
  <text x="60" y="320" font-family="Helvetica, Arial, sans-serif" font-weight="900" font-size="120" fill="${fg}" letter-spacing="-4">${escape(title.split(' ').slice(1).join(' '))}</text>
  <text x="60" y="780" font-family="Helvetica, Arial, sans-serif" font-weight="500" font-size="32" fill="${fg}" opacity="0.85">${escape(subtitle)}</text>
  <text x="60" y="900" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="34" fill="${fg}">${escape(meta)}</text>
</svg>`;
}

// Vertical gradient + serif display type
function gradient(opts: {
  from: string;
  to: string;
  fg: string;
  title: string;
  subtitle: string;
  meta: string;
}): string {
  const { from, to, fg, title, subtitle, meta } = opts;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <text x="60" y="540" font-family="Georgia, 'Times New Roman', serif" font-weight="400" font-style="italic" font-size="96" fill="${fg}">${escape(title)}</text>
  <text x="60" y="640" font-family="Georgia, 'Times New Roman', serif" font-weight="400" font-style="italic" font-size="44" fill="${fg}" opacity="0.85">${escape(subtitle)}</text>
  <text x="60" y="1050" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="30" fill="${fg}" letter-spacing="2">${escape(meta.toUpperCase())}</text>
</svg>`;
}

// Geometric: large circle + text
function geometric(opts: {
  bg: string;
  shape: string;
  fg: string;
  title: string;
  subtitle: string;
  meta: string;
}): string {
  const { bg, shape, fg, title, subtitle, meta } = opts;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <circle cx="${W / 2}" cy="450" r="240" fill="${shape}"/>
  <text x="${W / 2}" y="900" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="900" font-size="64" fill="${fg}" letter-spacing="-2">${escape(title)}</text>
  <text x="${W / 2}" y="970" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="400" font-size="32" fill="${fg}" opacity="0.78">${escape(subtitle)}</text>
  <text x="${W / 2}" y="1060" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="26" fill="${fg}" letter-spacing="3">${escape(meta.toUpperCase())}</text>
</svg>`;
}

// Two-color: text fills upper, accent block lower
function twoColor(opts: {
  bg: string;
  fg: string;
  accent: string;
  title: string;
  subtitle: string;
  meta: string;
}): string {
  const { bg, fg, accent, title, subtitle, meta } = opts;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>
  <rect x="0" y="700" width="${W}" height="${H - 700}" fill="${accent}"/>
  <text x="60" y="220" font-family="Helvetica, Arial, sans-serif" font-weight="900" font-size="140" fill="${fg}" letter-spacing="-6">${escape(title)}</text>
  <text x="60" y="380" font-family="Helvetica, Arial, sans-serif" font-weight="400" font-size="40" fill="${fg}" opacity="0.8">${escape(subtitle)}</text>
  <text x="60" y="820" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="42" fill="${bg}">${escape(meta)}</text>
  <text x="60" y="890" font-family="Helvetica, Arial, sans-serif" font-weight="400" font-size="28" fill="${bg}" opacity="0.85">Berlin, 2026</text>
</svg>`;
}

const DESIGNS: PosterDesign[] = [
  {
    slug: 'rough-trade',
    title: 'Rough Trade Night',
    subtitle: 'Berghain · Säule Floor — DJ rotation',
    meta: 'Sat 28 Feb 2026 · 23:00–08:00',
    svg: () =>
      bigType({
        bg: '#0A0A0A',
        fg: '#39FF14',
        title: 'ROUGH TRADE',
        subtitle: 'Berghain · Säule Floor · DJ rotation',
        meta: '28.02.26 · 23h →',
      }),
  },
  {
    slug: 'fleamarket',
    title: 'Kreuzberg Flea Market',
    subtitle: 'Vintage, prints, ceramics, plants',
    meta: 'Sun 22 March 2026 · 10:00–17:00',
    svg: () =>
      twoColor({
        bg: '#F2EBE0',
        fg: '#2B2A27',
        accent: '#C04A30',
        title: 'FLOH',
        subtitle: 'Kreuzberg Flea Market\nVintage · Prints · Ceramics · Plants',
        meta: '22 March · 10–17h',
      }),
  },
  {
    slug: 'who-owns',
    title: 'Who Owns the City?',
    subtitle: 'Urban policy salon · panel + Q&A',
    meta: 'Thu 16 April 2026 · 19:30',
    svg: () =>
      bigType({
        bg: '#C9382E',
        fg: '#FFFFFF',
        title: 'WHO OWNS',
        subtitle: 'Urban policy salon · panel + Q&A · Kreuzberg',
        meta: 'THU 16 APR · 19:30 · Free entry',
      }),
  },
  {
    slug: 'void-volume',
    title: 'Void & Volume',
    subtitle: 'Sculpture group show · 9 artists',
    meta: 'Opening Fri 8 May 2026',
    svg: () =>
      gradient({
        from: '#E9E5DC',
        to: '#BFBAA8',
        fg: '#1B1B18',
        title: 'Void & Volume',
        subtitle: 'Sculpture group show — nine artists from Berlin & Leipzig',
        meta: 'Opening Fri 8 May 19h',
      }),
  },
  {
    slug: 'tresor-4floor',
    title: 'Tresor 4-Floor',
    subtitle: 'Kompakt Records Night',
    meta: 'Sat 30 May 2026 · 23:30',
    svg: () =>
      gradient({
        from: '#180A2A',
        to: '#EB46B0',
        fg: '#FFFFFF',
        title: 'Tresor 4-Floor',
        subtitle: 'Kompakt Records Night — four rooms, twelve sets',
        meta: 'Sat 30 May · 23:30 → late',
      }),
  },
  {
    slug: 'riso-print',
    title: 'Riso Print Workshop',
    subtitle: '1-day intensive · 8 colours',
    meta: 'Sat 6 June 2026 · 11:00–18:00',
    svg: () =>
      bigType({
        bg: '#F5D547',
        fg: '#1A1A1A',
        accent: '#1A1A1A',
        title: 'RISO',
        subtitle: '1-day intensive · 8 colours · BYO sketches',
        meta: 'SAT 06 JUN · 11h–18h',
      }),
  },
  {
    slug: 'das-programm',
    title: 'Das Programm',
    subtitle: 'Experimental performance evening',
    meta: 'Thu 25 June 2026 · 20:00',
    svg: () =>
      bigType({
        bg: '#0E1F3A',
        fg: '#F3E9D2',
        title: 'DAS',
        subtitle: 'Experimental performance · 5 acts · Hebbel am Ufer',
        meta: 'THU 25 JUN · 20:00 · 14€',
      }),
  },
  {
    slug: 'zinefair',
    title: 'Berlin Zine Fair',
    subtitle: '60 makers · self-published only',
    meta: 'Sat 12 July 2026 · 12:00–20:00',
    svg: () =>
      geometric({
        bg: '#F26B3A',
        shape: '#1A1A1A',
        fg: '#F8F1E4',
        title: 'BERLIN ZINE FAIR',
        subtitle: '60 makers — self-published only',
        meta: '12.07.26 · Festsaal Kreuzberg',
      }),
  },
  {
    slug: 'funkhaus-late',
    title: 'Funkhaus Late',
    subtitle: 'Ambient listening session · pillows + drinks',
    meta: 'Fri 18 September 2026 · 22:00–02:00',
    svg: () =>
      gradient({
        from: '#0A0A0A',
        to: '#FF1E8E',
        fg: '#FFFFFF',
        title: 'Funkhaus Late',
        subtitle: 'Ambient listening session — pillows, drinks, no phones',
        meta: 'Fri 18 Sep · 22:00–02:00 · Funkhaus Studio 4',
      }),
  },
  {
    slug: 'openmic',
    title: 'Open Mic Prenzlauer',
    subtitle: 'Spoken word + brief sets',
    meta: 'Wed 7 October 2026 · 19:30',
    svg: () =>
      twoColor({
        bg: '#F2EBE0',
        fg: '#2B2A27',
        accent: '#2B2A27',
        title: 'OPEN',
        subtitle: 'Open Mic · Prenzlauer Berg\nSpoken word + brief sets',
        meta: 'Wed 07.10 · 19:30',
      }),
  },
];

// ─── Pipeline ───────────────────────────────────────────────────────────────

async function main() {
  const outDir = path.join(projectRoot, '.tmp', 'svg-posters');
  fs.mkdirSync(outDir, { recursive: true });

  const results: Record<string, { url: string; width: number; height: number }> = {};

  for (const d of DESIGNS) {
    const eventId = `evt-${d.slug}`;
    const svgString = d.svg();
    const svgPath = path.join(outDir, `${eventId}.svg`);
    const pngPath = path.join(outDir, `${eventId}.png`);

    fs.writeFileSync(svgPath, svgString);

    const buf = await sharp(Buffer.from(svgString)).png().toBuffer();
    fs.writeFileSync(pngPath, buf);

    const objectPath = `${PREFIX}/${eventId}.png`;
    const { error } = await supabase.storage.from(BUCKET).upload(objectPath, buf, {
      contentType: 'image/png',
      upsert: true,
      cacheControl: '31536000',
    });
    if (error) throw new Error(`Upload ${eventId}: ${error.message}`);

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
    results[eventId] = { url: data.publicUrl, width: W, height: H };
    console.log(`  ${eventId} → ${data.publicUrl}`);
  }

  const outJson = path.join(projectRoot, '.tmp', 'svg-poster-urls.json');
  fs.writeFileSync(outJson, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${outJson}`);

  // Print a paste-ready block so the next step (adding MOCK_EVENT entries
  // by hand) is mechanical.
  console.log('\n─── Mock event slugs ready to register ───');
  for (const d of DESIGNS) {
    console.log(`  evt-${d.slug.padEnd(15)}  ${d.title}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
