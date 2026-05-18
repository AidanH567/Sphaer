# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech Stack

React Native + Expo (SDK 51+), TypeScript strict, Expo Router (file-based routing), Supabase (PostgreSQL + Realtime + Storage + Auth), NativeWind for styling, React Context + custom hooks for state, React Native Reanimated + Moti for animations.

## Commands

```bash
npm install                                                        # install deps
npx expo start                                                     # dev server
npx expo start --ios / --android                                   # run on simulator
npx supabase db push                                               # push schema changes
npx supabase db pull                                               # pull latest schema
npx supabase gen types typescript --local > src/types/supabase.ts # regenerate types
eas build --platform ios / android                                 # EAS build
eas submit --platform ios / android                                # submit to store
```

## Environment Variables

Copy `.env.example` to `.env.local`. Required:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`

## Architecture

### Routing (`app/`)

Expo Router file-based routing. Parenthesized directories are route groups (don't appear in URLs):
- `app/(auth)/` — login, onboarding (outside tab nav)
- `app/(tabs)/` — main tab navigation
  - `feed/index.tsx` — chronological feed, `feed/map.tsx` — map view, `feed/mural.tsx` — poster wall
  - `circles/`, `create/`, `messages/`, `profile/`
- `app/event/[id].tsx`, `app/user/[id].tsx` — dynamic detail routes

### Layered Data Flow (`src/`)

```
Component → hook → service → Supabase client (src/lib/supabase.ts)
```

- **`src/services/`** — pure async functions, all Supabase queries/mutations, no React state
- **`src/hooks/`** — wrap services, manage loading/error/cache state; components call hooks, never services directly
- **`src/components/ui/`** — base design system (Button, Card, Avatar, Modal, Input, Tag)
- **`src/constants/theme.ts`** — all design tokens (colors, spacing, fonts, radii); never hardcode values inline
- **`src/types/supabase.ts`** — auto-generated from Supabase schema; regenerate after any schema change

### Key Database Tables

`profiles`, `events` (creator_id + optional circle_id), `circles`, `circle_members` (role: admin/member), `follows`, `circle_follows`, `saved_events`, `messages` (1:1 and circle group), `notifications`. Full schema is in `README.md`.

## Critical Design Decision

**Users do NOT need to join a circle to create an event.** Independent user-created events and circle-associated events coexist. `events.circle_id` is nullable for this reason. Never enforce circle membership as a prerequisite for event creation.

## Feed

Feed is always **chronological** — never ranked by engagement. Three display modes share the same filter state: list view (`feed/index.tsx`), map pins (`feed/map.tsx`), and full-screen swipeable poster wall (`feed/mural.tsx`).

## Realtime

DMs and notifications use Supabase Realtime subscriptions. Subscribe in hooks, clean up in `useEffect` return.

## Styling

NativeWind (Tailwind for React Native). All token values live in `src/constants/theme.ts` and must be wired into `tailwind.config.js`. Figma is the source of truth for all visual decisions.

## Git Workflow

Feature branch workflow — never commit to `main`. Branch naming: `feature/`, `fix/`, `chore/`, `refactor/`. Conventional commits (`feat:`, `fix:`, `chore:`, `refactor:`).
# Sphaer

> The digital cultural layer of Berlin's underground creative scene.

Sphaer is a social and community platform built specifically for Berlin artists, creatives, musicians, collectives, and cultural communities. It is a space where artists, communities, and events naturally connect — without algorithms, paid promotion, or engagement-driven ranking. Community first. Always.

---

## Philosophy

- **Made by Berlin artists, for Berlin artists**
- **Community-first, not algorithm-first** — the feed is chronological, never ranked by engagement
- **No pay-to-play** — users cannot boost posts or events with money
- **Equal visibility** — no single creator can dominate through algorithms or budget
- **Core values:** discovery, equality, local culture, authentic creative connection

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo (SDK 51+) |
| Language | TypeScript (strict mode) |
| Routing | Expo Router (file-based) |
| Backend | Supabase |
| Auth | Supabase Auth (Google, Apple OAuth) |
| Database | PostgreSQL via Supabase |
| Realtime | Supabase Realtime (DMs, notifications) |
| Storage | Supabase Storage (images, posters) |
| Styling | NativeWind (Tailwind for React Native) |
| State | React Context API + custom hooks |
| Maps | react-native-maps + Google Maps API |
| Animations | React Native Reanimated + Moti |
| Version Control | Git + GitHub (feature branch workflow) |

---

## Project Structure

```
sphaer/
├── app/                          # Expo Router file-based routing
│   ├── (auth)/                   # Auth screens (not part of tab nav)
│   │   ├── login.tsx
│   │   ├── onboarding.tsx
│   │   └── _layout.tsx
│   ├── (tabs)/                   # Main tab navigation
│   │   ├── feed/
│   │   │   ├── index.tsx         # Feed view (default)
│   │   │   ├── map.tsx           # Map view
│   │   │   └── mural.tsx         # Mural / poster wall view
│   │   ├── circles/
│   │   │   ├── index.tsx         # Browse circles
│   │   │   └── [id].tsx          # Individual circle page
│   │   ├── create/
│   │   │   └── index.tsx         # Create event / post
│   │   ├── messages/
│   │   │   ├── index.tsx         # DM inbox
│   │   │   └── [id].tsx          # Individual conversation
│   │   ├── profile/
│   │   │   └── index.tsx         # My profile
│   │   └── _layout.tsx           # Tab bar layout
│   ├── event/
│   │   └── [id].tsx              # Event detail page
│   ├── user/
│   │   └── [id].tsx              # Artist / user profile
│   └── _layout.tsx               # Root layout
│
├── src/
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # Base design system components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── Tag.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Modal.tsx
│   │   ├── feed/
│   │   │   ├── EventCard.tsx
│   │   │   ├── FeedHeader.tsx
│   │   │   ├── FilterBar.tsx
│   │   │   └── ViewToggle.tsx
│   │   ├── map/
│   │   │   ├── EventMap.tsx
│   │   │   └── MapPin.tsx
│   │   ├── mural/
│   │   │   ├── MuralSlider.tsx
│   │   │   └── PosterCard.tsx
│   │   ├── circles/
│   │   │   ├── CircleCard.tsx
│   │   │   └── CircleHeader.tsx
│   │   ├── events/
│   │   │   ├── EventDetail.tsx
│   │   │   ├── EventForm.tsx
│   │   │   └── TicketButton.tsx
│   │   ├── profile/
│   │   │   ├── ProfileHeader.tsx
│   │   │   └── ArtworkGrid.tsx
│   │   └── messaging/
│   │       ├── ChatBubble.tsx
│   │       └── MessageInput.tsx
│   │
│   ├── hooks/                    # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useEvents.ts
│   │   ├── useCircles.ts
│   │   ├── useProfile.ts
│   │   ├── useMessages.ts
│   │   └── useNotifications.ts
│   │
│   ├── context/                  # Global state
│   │   ├── AuthContext.tsx
│   │   └── AppContext.tsx
│   │
│   ├── lib/                      # External service clients
│   │   ├── supabase.ts           # Supabase client init
│   │   └── maps.ts               # Maps config
│   │
│   ├── services/                 # Business logic / API layer
│   │   ├── auth.service.ts
│   │   ├── events.service.ts
│   │   ├── circles.service.ts
│   │   ├── profile.service.ts
│   │   └── messages.service.ts
│   │
│   ├── types/                    # Global TypeScript types
│   │   ├── supabase.ts           # Auto-generated Supabase types
│   │   ├── event.types.ts
│   │   ├── circle.types.ts
│   │   ├── user.types.ts
│   │   └── message.types.ts
│   │
│   ├── utils/                    # Pure utility functions
│   │   ├── date.ts
│   │   ├── format.ts
│   │   └── validators.ts
│   │
│   └── constants/                # App-wide constants
│       ├── theme.ts              # Design tokens (colors, spacing, fonts)
│       ├── categories.ts         # Event categories / tags
│       └── config.ts             # Env-driven config
│
├── assets/                       # Static assets
│   ├── fonts/
│   ├── images/
│   └── icons/
│
├── supabase/                     # Supabase local dev config
│   ├── migrations/               # SQL migration files
│   └── seed.sql                  # Dev seed data
│
├── .env.local                    # Local environment variables (never commit)
├── .env.example                  # Example env vars (safe to commit)
├── app.json                      # Expo config
├── tailwind.config.js            # NativeWind / Tailwind config
├── tsconfig.json
└── README.md
```

---

## Core Features

### 1. Feed System — Three Views

The main experience is a unified feed with three display modes, switchable via a tab/toggle in the header.

#### A) Feed View
- Displays events chronologically — **never** algorithmically ranked
- Filter by: search bar, categories/tags
- Shows both individual user events and circle-created events
- Each event card shows: poster image, title, date, location, creator, category tags

#### B) Map View
- Events displayed as pins on an interactive Berlin map
- Pins update dynamically based on active search/filter state
- Tapping a pin shows a preview card; tapping the card opens full event detail
- Map should feel fluid, clean, and native

#### C) Mural View
- Full-screen swipeable poster wall
- One poster displayed at a time — immersive, full-bleed
- Swipe horizontally (or vertically) to navigate between posters
- Feels like a digital street poster wall — artistic and expressive

---

### 2. Circles (Community Groups)

Circles are community-created groups. Think: collectives, venues, music crews, art spaces.

**Users can:**
- Create a circle
- Join / leave / follow circles
- Browse public circles

**Each circle has:**
- A dedicated profile / community page
- A group chat / messaging area
- The ability to create events associated with the circle
- Member notifications for upcoming events

> ⚠️ **Important:** A user does NOT need to belong to a circle to create an event. Both independent events (user-created) and circle-associated events must coexist in the platform architecture. This is a core design decision.

---

### 3. Artist Profiles

Every user has an artist profile — expressive, creative, and clean.

**Profiles include:**
- Display name, bio, location, disciplines/tags
- Profile photo + cover image
- Portfolio / previous work grid
- Past and upcoming events
- Follower / following counts
- Follow + Message CTAs (on other users' profiles)

---

### 4. Event System

Events are the core unit of activity on Sphaer.

**An event can include:**
- Title, description
- Date and time
- Location (address + map coordinates)
- Category tags
- Poster / cover image
- Ticketing info (free or paid)
- Creator association (individual user or circle)

**Users can:**
- Browse, filter, and search events
- Save / bookmark events
- Share events
- Buy tickets
- View events in Feed, Map, or Mural view

---

### 5. Direct Messaging

- 1:1 messaging between users
- Circle group chat
- Built on Supabase Realtime
- Clean, minimal chat UI
- Push notifications for new messages

---

### 6. Notifications

- Event reminders (saved events)
- New followers
- Circle activity
- New messages
- New events from circles you follow

---

## Database Schema (Supabase / PostgreSQL)

```sql
-- Users / Profiles
profiles (
  id uuid references auth.users primary key,
  username text unique,
  display_name text,
  bio text,
  avatar_url text,
  cover_url text,
  disciplines text[],         -- e.g. ['music', 'visual art', 'DJ']
  location text,
  website text,
  created_at timestamptz
)

-- Events
events (
  id uuid primary key,
  creator_id uuid references profiles(id),
  circle_id uuid references circles(id) nullable,  -- null = independent event
  title text,
  description text,
  location_name text,
  address text,
  lat float,
  lng float,
  starts_at timestamptz,
  ends_at timestamptz,
  categories text[],
  poster_url text,
  ticket_url text,
  is_free boolean,
  price numeric,
  created_at timestamptz
)

-- Circles
circles (
  id uuid primary key,
  creator_id uuid references profiles(id),
  name text,
  description text,
  avatar_url text,
  cover_url text,
  tags text[],
  is_public boolean,
  created_at timestamptz
)

-- Circle Members
circle_members (
  circle_id uuid references circles(id),
  user_id uuid references profiles(id),
  role text,  -- 'admin' | 'member'
  joined_at timestamptz,
  primary key (circle_id, user_id)
)

-- Follows (user → user)
follows (
  follower_id uuid references profiles(id),
  following_id uuid references profiles(id),
  created_at timestamptz,
  primary key (follower_id, following_id)
)

-- Circle Follows (user → circle)
circle_follows (
  user_id uuid references profiles(id),
  circle_id uuid references circles(id),
  created_at timestamptz,
  primary key (user_id, circle_id)
)

-- Saved Events
saved_events (
  user_id uuid references profiles(id),
  event_id uuid references events(id),
  saved_at timestamptz,
  primary key (user_id, event_id)
)

-- Messages (DMs)
messages (
  id uuid primary key,
  sender_id uuid references profiles(id),
  recipient_id uuid references profiles(id) nullable,  -- null if circle message
  circle_id uuid references circles(id) nullable,
  content text,
  created_at timestamptz
)

-- Notifications
notifications (
  id uuid primary key,
  user_id uuid references profiles(id),
  type text,  -- 'follow' | 'event_reminder' | 'circle_event' | 'message'
  reference_id uuid,
  is_read boolean,
  created_at timestamptz
)
```

---

## Authentication

- **Provider:** Supabase Auth
- **Methods:** Google OAuth, Apple OAuth
- **Flow:**
  1. User taps "Continue with Google" or "Continue with Apple"
  2. OAuth flow completes via Expo AuthSession
  3. Supabase session is stored securely
  4. On first login, user is taken through onboarding (username, disciplines, profile photo)
  5. On subsequent logins, user lands on the Feed

---

## Environment Variables

Create a `.env.local` file in the project root (never commit this):

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

See `.env.example` for the full list of required variables.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo`)
- Supabase account + project
- EAS CLI for builds (`npm install -g eas-cli`)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/sphaer.git
cd sphaer

# 2. Install dependencies
npm install

# 3. Copy env file and fill in your values
cp .env.example .env.local

# 4. Push the database schema to Supabase
npx supabase db push

# 5. Start the development server
npx expo start
```

---

## GitHub Workflow

This project uses a **feature branch workflow**. Never commit directly to `main`.

### Branch naming
```
feature/feed-map-view
feature/circles-profile-page
fix/event-card-layout
chore/supabase-types-regen
```

### Commit message format
```
feat: add map view with dynamic event pins
fix: correct avatar upload flow on profile page
chore: regenerate supabase types
refactor: extract EventCard into reusable component
```

### Pull Request process
1. Create a branch from `main` for each feature
2. Build the feature with clean, complete code
3. Open a PR with a description of: what was built, files changed, env vars needed, setup steps
4. Review and merge into `main`

### After each feature, summarise:
- What files were created or changed
- What the feature does
- Any setup steps to run locally
- Any new environment variables required
- Any known issues or unfinished parts

---

## Design & UI Principles

> The Figma design files are the **source of truth**. All implementations must match the designs as closely as possible.

- **Spacing, typography, colors, layouts** — match Figma exactly
- **Animations and transitions** — implement all motion from Figma
- **Mobile-first** — designed for 375px–430px width, tested on both iOS and Android
- **Reusable components** — build a shared component/design system in `src/components/ui/`
- **Visual consistency** — every screen should feel like one coherent product

### Design Tokens

All colors, font sizes, spacing, and border radii must be defined in `src/constants/theme.ts` and referenced via NativeWind / Tailwind config. Never hardcode design values inline.

---

## Development Standards

- **TypeScript strict mode** — no `any`, no implicit types
- **Business logic lives in services** — never directly in components
- **Hooks wrap services** — components consume hooks, not raw service calls
- **Complete implementations** — no pseudo-code, no placeholder logic
- **Full file output** — always include imports and complete file content
- **Think like a senior engineer** — scalable, readable, maintainable

---

## Roadmap

- [ ] Auth + Onboarding flow
- [ ] Feed view (chronological events)
- [ ] Map view (event pins on Berlin map)
- [ ] Mural view (swipeable poster wall)
- [ ] Event detail page
- [ ] Create event flow
- [ ] Artist profiles
- [ ] Follow system (users + circles)
- [ ] Circles — browse, create, join
- [ ] Circle profile pages + group chat
- [ ] Direct messaging (1:1)
- [ ] Saved / bookmarked events
- [ ] Notifications
- [ ] Ticket integration
- [ ] Push notifications (Expo Notifications)
- [ ] App Store + Google Play build (EAS)

---

## Figma

The Figma design file is the single source of truth for all UI decisions. Before implementing any screen or component, reference the corresponding Figma frame. If a design decision is unclear, err on the side of the Figma over any assumptions.

> Link to Figma: _[add your Figma share link here]_

---

## License

Private. All rights reserved. © Sphaer.