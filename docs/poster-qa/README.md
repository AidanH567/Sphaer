# Poster QA — visual evidence for the generator

A green test suite proves nothing about whether a poster has anything on it.
Production already contains the counter-example: eight of the fifty seeded
Mural posters are valid WebP files that download with HTTP 200, decode without
error, report sane dimensions and paint **nothing**
(`npx tsx scripts/audit-posters.ts` measures them at 0.0% visible pixels).

So the generator is judged on pixels. Everything here is a real render that was
looked at, not a claim that it works.

## What is in here

| File | What it is |
|---|---|
| `_families-contact-sheet.png` | **Start here.** All four layout families × with/without a photo × several palettes, on realistic Berlin titles. The sheet the family work is judged on. |
| `_families-thumbnails.png` | The same 16 posters at 118px wide — actual mural wall scale. A composition that only works full-screen has failed, and this is where that shows. |
| `families/<slug>.png` | The individual full-size renders behind those two sheets. |
| `<slug>.png` | Typographic poster generated from a **real production event** — title, date, time, venue only. This is the output the shipped feature actually produces. |
| `_contact-sheet.png` | The four above, side by side, at mural thumbnail scale. Pre-families, kept for the before/after. |
| `web-a-plain.png` | Captured from the **react-native-svg renderer running in real Chromium**, via `Svg.toDataURL()` — the exact bytes the upload path would have sent. |
| `web-b-scaled.png` | The same capture with a `transform: scale(0.25)` on the offscreen host. See "The trap" below. |
| `_view-*.png` | 430px-wide versions of the two web captures, for looking at. |

Intermediate `.svg` files are gitignored; they regenerate with the PNGs.

## Regenerating

```bash
npx tsx scripts/qa-generate-poster.ts --families   # every family → contact sheet (no network)
npx tsx scripts/qa-generate-poster.ts             # 3 real events, typographic
npx tsx scripts/qa-generate-poster.ts --limit 6
npx tsx scripts/qa-generate-poster.ts --with-photo # exercise the photo branch
npx tsx scripts/qa-generate-poster.ts --offline    # synthetic fixtures, no network
```

Read-only: it fetches public events with the anon key and writes nothing to the
database or to Storage. `--families` needs no network at all.

The photographs on the family sheet are cropped out of the hand-authored seed
posters in `scripts/seed-assets/posters/` (see `scripts/poster-qa-photos.ts`) —
there are no standalone photos in the repo, and a synthetic gradient cannot
answer the only question worth asking about `panel`, which is whether type stays
readable on a plate floating over a real image.

## The families

| Family | Reference | Geometry | Without a photo |
|---|---|---|---|
| `classic` | the original template | Photo across the top, solid type band beneath, serif title | Full-bleed accent field with the date at 340px |
| `block` | `refined-play.png` | Swiss two-block: colour block + heavy grotesque above, meta \| photo split below | The photo block becomes a solid `fg` field carrying the date at 200px |
| `spine` | `berlin-shiatsu.png`, `nigerian-film-festival.png` | Title rotated -90° up the left edge, oversized date in the right field | The right field carries the numeric date and a rule — which is what the reference itself does |
| `panel` | `earthbodies.png` | Full-bleed photograph, centred type on an inset plate, hairline frame | The ground becomes a flat accent field; same plate, same frame |

Selection is **category first, then hash**: an event's first recognised category
picks a two-family shortlist, and the hash picks within it, so a club night and
an exhibition never reach for the same geometry. Everything is a pure function
of (title, start time, categories, variant) — the same event regenerates
identically on every platform, forever.

`variant` is what the Shuffle button on the create screen increments.

## Two renderers, one layout

`src/utils/poster-template.ts` solves the layout — every rect, every baseline,
every font size — and draws nothing. Two renderers consume it:

* `src/components/events/GeneratedPosterCanvas.tsx` (react-native-svg) — what
  users generate on device.
* `posterLayoutToSvgString()` → `sharp` — what the QA script rasterises, so the
  maths can be measured in Node without a device.

Neither may compute a coordinate of its own. That is asserted in
`src/components/events/__tests__/GeneratedPosterCanvas.test.tsx`, and it is why
the two renders below are the same composition.

## Measurements (2026-08-17)

Node / sharp render, four real events, all 1080×1528:

| Event | Bytes | Visible pixels | Ink |
|---|---|---|---|
| Foreign Diplomats Live at Badehaus | 77.4 KB | 100.0% | 6.51% |
| Open Mic Prenzlauer — Spoken Word + Brief Sets | 80.2 KB | 100.0% | 6.33% |
| Studio 8 Berlin — Berlin Collection Launch | 75.5 KB | 100.0% | 6.09% |
| SXTN — "Kann Sein, Dass Scheiße Wird" Tour | 77.9 KB | 100.0% | 6.15% |

Real react-native-svg render in Chromium: **1080×1528, 97,089 bytes, 100.0%
visible pixels, 6.17% ink** — the same composition the Node renderer produces.

**"Visible pixels"** is the exact alpha metric from `scripts/audit-posters.ts`,
where the eight broken production posters score 0.0%. It is necessary but not
sufficient here: the template paints an opaque background by design, so it
scores 100% even if nothing else drew. **"Ink"** is the fraction of pixels
differing from the poster's own background colour — that is the number that
says the type actually painted. A flat colour field scores ~0%.

## The second trap — an accent that ate the photograph (2026-08-18)

`spine` shipped one contact sheet with a backing plate pushed at exactly the
photo's rect. Accents are drawn **after** the photo (`background → photo → band
→ accents → texts`), so the plate covered the photograph completely and four
tiles rendered as a flat magenta rectangle.

Every check passed. The layout was paintable, the PNG was 1080×1528 and the
right size on disk, and the **ink fraction went up**, because a solid magenta
block is ink. Nothing measured it as wrong. It was found by looking at the
contact sheet.

`src/utils/__tests__/poster-families.test.ts` now asserts that no band or accent
covers more than 90% of a family's own photo rect — a plate may sit *on* the
photograph (that is what `panel` is), it may not replace it. The test was
verified by reintroducing the bug and watching it fail.

## The trap

`web-b-scaled.png` is a **1080×1528 PNG, 38 KB, 100% opaque** that contains the
top-left quarter of the poster magnified, and no text whatsoever. Every check in
`src/utils/poster-guard.ts` passes it: from the bytes it is indistinguishable
from a good poster.

The cause is react-native-svg's web `toDataURL`, which does not snapshot the
element — it clones it into a new `<svg>` whose `viewBox` comes from
`getBoundingClientRect(ref)`. Any CSS transform above the canvas therefore
crops the capture. `onLayout` cannot detect it (react-native-web reports the
untransformed 1080×1528 in both cases).

This was found by driving the exported web build in Chromium, not by reasoning
about it, and it is exactly the "valid file, wrong content" family that put the
eight blank tiles on the wall. `assertCanvasBoxIsUntransformed` in
`GeneratedPosterCanvas.tsx` now rejects it before capture, and the file is kept
here as the evidence of what it looks like.

## Reproducing the browser capture

The harness route is deliberately **not** committed — it renders the canvas
visibly and is not part of the app. To rebuild it, add a temporary
`app/__poster-qa.tsx` that mounts `GeneratedPosterCanvas` via
`useGeneratedPoster`, calls `capture()`, and puts the result in an `<img>`; then
follow the same export/serve/drive recipe as `docs/mural-qa/README.md`:

```bash
npx expo export --platform web --dev --output-dir .tmp/qa-poster
python docs/mural-qa/serve-spa.py .tmp/qa-poster 8794
# drive http://127.0.0.1:8794/__poster-qa with playwright-core
```

Delete the route afterwards.
