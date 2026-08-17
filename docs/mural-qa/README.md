# Mural QA — before / after

Visual evidence for the 2026-08-17 mural fix. A green test suite proves nothing
about a layout bug, so the wall was driven in a real browser at **390 × 844**
(iPhone 13/14) against the live Supabase data (50 public events) and measured.

## How to reproduce

```bash
# 1. Build the app for web. --dev keeps __DEV__ true, which is what bypasses
#    the (tabs) auth gate — a production export redirects to /(auth).
npx expo export --platform web --dev --output-dir .tmp/qa

# 2. Serve it with an SPA fallback (expo export emits a single index.html).
python docs/mural-qa/serve-spa.py .tmp/qa 8792

# 3. Drive it. Needs playwright-core + a chromium build:
#      npm i --no-save playwright-core && npx playwright install chromium
node docs/mural-qa/mural-qa.js http://127.0.0.1:8792 docs/mural-qa after
```

Note the driver uses **CDP touch events**, not `page.mouse`. react-native-gesture-handler
on web ignores synthetic mouse drags, so a mouse-driven test silently measures a
wall that never moved.

## What the shots show

| file | state |
|---|---|
| `*-1-landed.png` | the wall as it first appears |
| `*-2-top-left-corner.png` | panned hard into the top-left limit |
| `*-3-bottom-right-corner.png` | panned hard into the bottom-right limit |
| `*-4-overscroll-held.png` | a drag past the corner, **finger still down** |
| `*-5-after-release.png` | the same drag, released |

`4` and `5` are the pair that matters for the overscroll complaint: if they
differ, the wall snapped back.

## Measurements

From `before-measurements.json` / `after-measurements.json`.

| metric | before | after |
|---|---|---|
| gutter values across the wall | `[0]` (none) | `[8]` (one value) |
| row right edges spread | **138.8 px** ragged | **0 px** flush |
| row left edges spread | 0 px | 0 px |
| biggest empty rectangle at the bottom-right limit | **80 × 200 px** | 375 × 10 px (a gutter) |
| biggest empty rectangle while overscrolled | **105 × 200 px** | 375 × 10 px (a gutter) |
| screen coverage while overscrolled | 82.0 % | 92.1 % |
| snap-back on release | **24.5 px x, 34.1 px y** | **0, 0** |
| wall fully painted (median of 3 cold loads) | ~12.0 s | ~8.8 s |

"Biggest empty rectangle" is the largest all-empty axis-aligned rectangle in the
visible wall area, found by a maximal-rectangle scan over a 5 px sample grid.
Raw coverage can't tell a designed 8 px gutter from a hole; a rectangle that is
fat in *both* directions can only be a hole. After the fix the biggest empty
rectangle is 10 px thin — i.e. it is the gutter grid, and there are no holes.

## Still outstanding (data, not layout)

`npx tsx scripts/audit-posters.ts` reports **7 of 50 seeded posters are fully
transparent images** and 1 is too small for a mural slot. They render as empty
tiles no matter how good the layout is. See the agent report for the list.
