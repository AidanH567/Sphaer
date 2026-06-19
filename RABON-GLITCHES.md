# Sphaer — Rabon's Figma glitch audit (tracker)

> **Source:** Figma `Sphaer_Prototype_RA` (`HIVq6Vaymj01dZ37AvwCUF`), node **`6516:19`**
> ("Glitches & bugs documentation"), the **right-hand column** of phone mockups +
> annotations. **Author:** Rabon (test account `rabon alto` / "RA"; several screenshots
> are from the live web build `…cv6rkc.vercel.app`).
> **Read & logged:** 2026-06-19.
>
> The **left cluster** of that same board is **Lara's earlier audit (2026-06-17)** — already
> triaged in [`BACKLOG.md`](BACKLOG.md) as items `#1–#11`. This file tracks only the **new
> Rabon items (`R1–R12`)** and the running **fix log**.

---

## Status key
- 🔴 **Open** — not started
- 🟡 **In progress**
- ✅ **Fixed** — implemented (see Fix log for commit)
- ⚪ **Needs decision** — a product call is required before building (often because it
  conflicts with something already shipped)

---

## Fix log (what we've actually changed)

> Append one line here every time a glitch moves to ✅. Keep it 1:1 with commits so Rabon
> and the team can see exactly what's been addressed on the Figma board.

| Date | Item | Summary | Commit |
|------|------|---------|--------|
| 2026-06-19 | **R3** (partial) | Feed/Map/Mural toggle moved off its off-grid 30px inset to the 16px margins, flush with the search row (`SearchFilterBar` `middleSlot`). Icon-swap part still blocked on the Master Flow ref. | _branch `claude/funny-kare-983d2c`_ |
| 2026-06-19 | **R11** | Search-container placeholder + input reduced md/17 → base/15 (`SearchFilterBar`), so "Find your scene…" matches body text. | _branch `claude/funny-kare-983d2c`_ |
| 2026-06-19 | **R12** (partial) | Circles section title→subtitle gap fixed from off-grid 2px → 4px (`circles/index.tsx`). Fuller spacing tuning still needs the exact Figma target. | _branch `claude/funny-kare-983d2c`_ |

> Verification: `tsc` ✅ · `eslint` ✅ (0 warnings) · `jest` ✅ (161/161). Visual preview of the
> feed/circles screens is **auth-gated** and I have no login (can't create accounts / enter
> passwords), so these style-only changes were validated by the test/lint/type gate, not a
> live screenshot.

---

## Rabon's new glitches

### R1 — Create-activity / Create menu "has been modified" 🔴
**Where:** Create-activity screen → "Create" bottom-sheet (Activity / Circle / Preview).
**Quote:** *"This one has been modified."*
**Read:** Rabon redesigned the create flow (the `+` create menu / create-activity screen)
in Figma — an FYI that the dev build should be re-synced to the **new** design, not a bug per se.
**Code:** `app/(tabs)/create/index.tsx`, `src/components/menus/CreateMenuSheet.tsx` (or equiv).
**Needs:** confirm with Rabon *what* changed (which fields/layout) before re-syncing.

### R2 — DM message input not centered ⚪ (needs your input)
**Where:** 1:1 chat screen, message composer (live web build, pink-boxed).
**Quote:** *"the message is not centered in the chat space"* (sic "spaec").
**Read:** the `Message…` input bar + send button row looks off-centered.
**Code:** `src/components/messaging/MessageInput.tsx`; `app/(tabs)/messages/[id].tsx`.
**Investigated 2026-06-19:** the composer is **horizontally symmetric in code** — container
`paddingHorizontal: 16`, input `flex: 1`, 8px gap, 36px send button. And the web shell has **no
max-width frame** (full device-width on iPhone), so it isn't a centered-column artifact either.
Best guess: a **vertical** alignment quirk — on web a `multiline` TextInput renders as a
`<textarea>` whose single-line placeholder top-aligns instead of centering. **Status:** ⚪ I
didn't want to guess-fix the wrong axis. Need from Rabon: is the input off **left/right** or
**top/bottom**, and a fresh screenshot of the live build.

### R3 — Feed/discovery view + Feed/Map/Mural toggle spacing 🟡 (spacing ✅ / icons blocked)
**Where:** feed top, the Feed / Map / Mural toggle row ("CTA ICONS").
**Quote:** *"This entire view or discovery CTA needs to be optimised like the original, mostly
due to spacing issues. The icons are also different to the ones in the original. The padding
is 16 on the left and right, so the button needs to fill the margins. You can see the final
screens on the Master Flow page."*
**Read:** (a) overall feed-view spacing is off; (b) horizontal padding should be **16px L/R**
and the toggle/button should **fill the margins**; (c) the toggle **icons** differ from the
final design — adopt the new CTA icons. Reference: **Master Flow page** in Figma.
**Code:** `src/components/feed/ViewToggle.tsx`, `src/components/feed/FeedHeader.tsx`,
`app/(tabs)/feed/index.tsx`.
**✅ Done (2026-06-19):** the toggle was inset **30px** while the search row sits at **16px** —
that mismatch was the spacing issue. Changed `SearchFilterBar.middleSlot` paddingHorizontal
30 → 16; the toggle (`width:100%`, space-between) now sits flush to the 16px margins.
**🔴 Still blocked:** "the icons are different to the ones in the original" — needs the **new CTA
icons** / **Master Flow page** node id to swap `list/map/images-outline` for the final set.

### R4 — Messages: add a private⇄circle chat switch 🔴
**Where:** Messages/inbox — "New screen" mockups show a `Chat | Circles` segmented toggle +
`All / Unread / Archive / Favourites` tabs, and a circle group chat ("Berlin Film Community").
**Quote:** *"Would it be possible to add a button to the chat screen to make switching between
private and circle chats easier? … the Messenger feature in this app needs improvement — it's
actually the only part of the app where users have direct interaction. … i think for now its
good to have a switch between private chat and groups chat."*
**Read:** add a **Chat / Circles** toggle at the top of the inbox so users flip between 1:1 DMs
and circle group chats; optionally the `All/Unread/Archive/Favourites` filter row.
**Code:** `app/(tabs)/messages/index.tsx` (+ `messages/circle/[id].tsx`).

### R5 — Messages list: match the style-guide component 🔴
**Where:** inbox conversation list ("Current screen").
**Quote:** *"Please follow this style guide for fonts and spacing specifications. Could you use
the same parameters? I have posted the original component on the developer page."*
**Read:** the inbox row font sizes/spacing should match Rabon's reference component on the
**developer page** in Figma.
**Code:** `app/(tabs)/messages/index.tsx` (conversation rows).
**Needs:** the developer-page node id for the reference component.

### R6 — Event detail: Message vs Following button size mismatch ⚪
**Where:** event-detail artist row (also circle detail).
**Quote:** *"I'm not sure if we need the message button there. We can go to the profile and send
a message, which would give us more room. At the moment, the circle message button and the
following button don't match… one is bigger than the other!"*
**Read:** the **Message** and **Following** buttons are mismatched in size; either align them or
**remove the Message button** (message from the profile instead).
**Code:** `app/event/[id].tsx` (artist row), `app/(tabs)/circles/[id].tsx` (organizer row).
**Note:** the Message button was added this earlier per BACKLOG ("Message the host from an
event"). ⚪ Needs decision: keep-and-resize vs remove.

### R7 — Event detail: top icon row too busy ⚪
**Where:** event-detail header (icons: ticket, chat, calendar, share, bookmark, ⋯).
**Quote:** *"This section where all the icons are is quite busy. So we should keep one or two
icons in the top, properly 'Share' and 'Save'. Remove the rest out … find it in my profile page
where all the tickets, activity history, booked staff etc. Alternatively, we could hide the
icons … in the first button on the right (…)."*
**Read:** keep only **Share + Save** in the header; move ticket/activity-history/booked-staff to
the **profile**, or collapse the extras into the **⋯ overflow** menu.
**Code:** `app/event/[id].tsx` (header action row).
**Note:** ⚪ touches what icons exist — confirm which actions stay vs move to profile.

### R8 — Adopt a 4-point grid system everywhere 🔴
**Where:** profile "rabon alto" screen + the "4-point grid system" ruler graphic (8/16/24/32/40).
**Quote:** *"Overall, there are many spacing issues in the entire designer system. maybe try to
use this grid system for everything … applied to the 4-point grid system … I start with 4, 8 or
12, never 3, 5 or 15, as per the guide above!"*
**Read:** global — audit spacing so all gaps/paddings are **multiples of 4** (4/8/12/16/24/32…),
never 3/5/15. Likely a `src/constants/theme.ts` spacing-scale audit + sweep.
**Code:** `src/constants/theme.ts` + a repo-wide spacing pass.
**Note:** large/cross-cutting — best done as its own scoped task.

### R9 — Feed card must stay minimal (poster + title + date/time/price only) ⚪
**Where:** feed list, event card ("Film Screening… / Sat 28 May / 17:00–23:30 / Free…").
**Quote:** *"We actually decided to keep the activity title and A-sized poster on the right,
along with the date, time and price. This is because including any more information would make
the UX and UI too noisy. If more information is needed, then we can access the activity profile."*
**Read:** feed cards should show **only** the title + A-size poster (right) + date/time/price.
**Code:** `src/components/feed/EventCard.tsx`.
**⚠️ CONFLICT:** this **reverses** the already-shipped `#9 Feed card expanded` (subtitle +
description snippet + "X going" — BACKLOG marks it ✅ Done, `c84013b`/EventCard). ⚪ **Needs
decision:** revert the expanded card to the minimal version per Rabon, or keep expanded?

### R10 — Search: Hick's law — collapse category tags into the search bar 🟡 (mostly already built)
**Where:** feed → search → map ("Final screen").
**Quote:** *"The first version displayed all the category tags on the screen simultaneously …
cluttered … I moved the categories into the search bar itself … Tap the bar and they appear,
ignore it and they disappear … Please follow the same process on the final screen. … Add the
category and filter options inside the filter, when I click on it, it slides down and I have all
the options, categories, filters (near me, …) etc."*
**Read:** hide category tags by default; reveal them when the **search bar is tapped**; put
filters (categories + near-me etc.) inside a **filter that slides down on tap**. Apply on the
final/map screen too.
**Code:** `src/components/feed/FilterBar.tsx`, `src/components/feed/SearchFilterBar.tsx`,
`src/components/feed/NeighborhoodFilter.tsx`, `app/(tabs)/feed/index.tsx` + `feed/map.tsx`.
**Finding (2026-06-19):** the "tap the bar → categories appear, ignore → they disappear" behaviour
is **already in the code** — `SearchFilterBar` only shows the category row when `searchActive ||
hasSearchText || hasSelectedCategories`. So the core Hick's-law ask is satisfied today. **What's
left & needs your call:** the *separate* "filter button that slides down categories + filters
(near me, …)" — that's the **filter-sheet vs chips** product decision already open in
[`BACKLOG.md`](BACKLOG.md) "▶ UP NEXT #1". Don't build until that's decided.

### R11 — Search placeholder text too large ✅
**Where:** search container ("Find your scene, find your thing!" — Circles search).
**Quote:** *"The text in the search container is large. Make sure it is the same size as the
smaller text or follow [the parameter]."*
**Read:** reduce the search field **placeholder font size** to match the smaller reference.
**Code:** `src/components/feed/SearchFilterBar.tsx` (`searchPlaceholder` + `searchInput`).
**✅ Done (2026-06-19):** both dropped from `fontSize.md` (17) → `fontSize.base` (15). Note: this
style is **shared** — it also affects the Feed's *expanded* search input (the Feed resting state
shows the greeting line, so no visible change there). If Rabon meant an even smaller size, it's a
one-line change to `sm` (13).

### R12 — Circles/category browse: title/subtitle/card spacing wrong 🟡 (grid fix ✅ / target TBD)
**Where:** circle category pages (e.g. "Film / Join 7 Film circles across Berlin" + circle cards;
also Dance / Technology & Making sections).
**Quote:** *"The spacing between the title, subtitle and cards is incorrect."* / *"Just follow
the same parameter as the other [screens]."*
**Read:** fix the vertical spacing between the section **title**, **subtitle**, and the **circle
cards** on the circles browse / category pages (ties into R8's 4-pt grid).
**Code:** `app/(tabs)/circles/index.tsx`, `src/components/circles/CircleCard.tsx`.
**🟡 Partial (2026-06-19):** the title→subtitle gap was an off-grid **2px** — snapped to **4px**
(`spacing.xs`), the one clearly wrong value per Rabon's own 4-pt rule. The other gaps are already
on-grid (section 20 / header-bottom 12 / card row 8). **Open:** "incorrect" has no exact target
in the note — if Rabon has specific px (or a "same as the other screens" reference), I'll match it.

---

## Cross-references to already-shipped work (watch for conflicts)
- **R9 ⟷ `#9 Feed card expanded` (shipped, `c84013b`)** — direct conflict; Rabon wants it minimal.
- **R6 ⟷ "Message the host from an event" (shipped)** — Rabon questions the Message button.
- **R2** is a live-build layout bug, independent of the Figma redesign.

## Open dependencies (need from Rabon/team before some fixes)
- **Master Flow page** node id (R3 — target icons + spacing).
- **Developer page** reference component (R5 — inbox fonts/spacing).
- Decision on **R6, R7, R9** (product calls).
