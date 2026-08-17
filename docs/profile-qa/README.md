# Profile + Circles QA

> ## ⚠️ v2 (2026-08-17, later the same day) — the `after-*` shots below were REJECTED
>
> Aidan looked at the Instagram-style restructure captured in `after-*.png` and
> asked for the original profile back: *"exactly like it did before, but when
> you click Activities it has these categories."* The layout was reverted; the
> tab CATEGORIES survived, inside the Activities sheet.
>
> **The acceptance test is `v2-own-profile.png` vs `before-profile.png`** —
> they should be the same page. They are: centred avatar, name + verified
> badge, role, location, link, the four-stat row with dividers, one full-width
> Edit Profile button, About with "Read more >", then Activity. The only
> difference is the Activities number, which now counts the All union.
>
> | file | what it shows |
> |---|---|
> | `v2-own-profile.png` | **the restored layout** — compare against `before-profile.png` |
> | `v2-own-profile-sheet-all.png` | Activities sheet, default All tab, own profile |
> | `v2-own-profile-sheet-going.png` | Going — upcoming registrations only |
> | `v2-own-profile-sheet-saved.png` | Saved — upcoming bookmarks, own profile only |
> | `v2-own-profile-sheet-past.png` | Past — everything finished, saves included |
> | `v2-own-profile-ticket.png` | after tapping a row's ticket badge → `/ticket/<id>` |
> | `v2-user-profile.png` | public profile (`/user/<id>`, Nils Brandt), restored layout |
> | `v2-user-profile-sheet-*.png` | public sheet: **All 45 · Going 6 · Past 39, no Saved** |
>
> Reproduce with `docs/profile-qa/profile-qa-v2.js` (same three steps below;
> it additionally taps the Activities stat, walks every category, and taps the
> first ticket badge). `v2-own-*` comes from a throwaway fixture build — see
> "Fixture builds" at the bottom. Rejected `after-*` shots are kept for the
> record, not as a target.
>
> Measurements: `v2-measurements.json` (production build, public profile) and
> `v2-own-measurements.json` (fixture build, own profile). Both runs: document
> scrollWidth 390, **0** overflowing elements, **0** broken images, and no
> standalone Saved or Tickets button anywhere.

## Before / after (v1 — superseded)

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

## Fixture builds

`fixture-*` shots come from a build patched to force `hasSession` and feed
fixture circles behind `?qafull` / `?qaempty`. That patch was reverted
immediately; it is not part of the change.

`v2-own-*` uses the same trick for the Activities sheet. A production export
redirects `/profile` to `/(auth)` with no session, and the `--dev` fallback
renders the mock profile with inert stats — so neither reaches the own-profile
sheet. A throwaway patch gave the dev fallback an `onActivitiesPress` and a
fixture activity set (3 upcoming + 8 past registered, 2 upcoming + 1 past
saved, deliberately past-heavy like Aidan's real 56/6 account, one activity
ticketed-and-registered and one carrying only an external `ticket_url`). That
patch was stripped before the final typecheck, lint, test and commit; `git
grep QA_TABS` returns nothing.

The public-profile evidence needs no fixture — `profiles` and
`event_registrations` are world-readable, so `v2-user-profile-*` is live data.

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
