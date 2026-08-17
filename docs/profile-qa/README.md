# Profile + Circles QA — before / after

Visual evidence for Lara's points #7 (profile redundancy) and #8 ("My circles"),
2026-08-17. A green jest suite proves nothing about an information-architecture
change, so both screens were driven in a real browser at **390 × 844**
(iPhone 13/14) against live Supabase data and measured.

## How to reproduce

```bash
# 1. Build for web. --dev keeps __DEV__ true, which bypasses the (tabs) auth
#    gate — a production export redirects to /(auth).
npx expo export --platform web --dev --output-dir .tmp/qa-after

# 2. Serve with an SPA fallback (expo export emits a single index.html).
python docs/mural-qa/serve-spa.py .tmp/qa-after 8822

# 3. Drive it. Needs playwright-core + a chromium build:
#      npm i --no-save playwright-core && npx playwright install chromium
node docs/profile-qa/profile-qa.js http://127.0.0.1:8822 docs/profile-qa after
```

## What the shots show

| file | screen |
|---|---|
| `*-profile.png` | own profile (`/profile`), first viewport |
| `*-user-profile.png` | a real public profile (`/user/<id>` — Nils Brandt, 45 activities) |
| `*-circles.png` | circles browse (`/circles`) |
| `*-full.png` | the same page, full scroll height |
| `fixture-mycircles-*.png` | "My circles" populated + empty, from a throwaway fixture build |

The exported build has no Supabase session, so `/profile` renders the dev
fallback and `MyCirclesSection` correctly renders nothing. `/user/<id>` needs
no session — `profiles` and `event_registrations` are world-readable — so the
**populated** evidence is genuinely live data, not a mock.

`fixture-*` shots come from a build patched to force `hasSession` and feed
fixture circles behind `?qafull` / `?qaempty`. That patch was reverted
immediately; it is not part of the change.

## Measurements

From `before-measurements.json` / `after-measurements.json`.

### The compactness test
"Identity + the start of content fit one 390×844 screen without scrolling."

| | before | after |
|---|---|---|
| own profile — first activity content starts at | **671 px** (first card clipped by the fold) | tab strip complete at **431 px**, first content complete at **484 px** |
| public profile — inline activity content | **none at all** (only a sheet behind an unlabelled number) | tab strip at **408 px**, list rendering |
| headroom left on own profile | — | **360 px** |

### Layout health (all pages, both runs)

| metric | value |
|---|---|
| document scrollWidth | 390 px (no horizontal page scroll) |
| overflowing elements outside a horizontal scroller | 0 |
| broken images | 0 |

### Discoverable controls

| screen | before | after |
|---|---|---|
| public profile tappables | 9 | **15** |

The public profile gained real, visible affordances: previously a user's
activities were reachable only by guessing that the "Activities" *number* was
a button.
