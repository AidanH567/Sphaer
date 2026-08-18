import type { Database } from './supabase';
import type { Profile } from './user.types';
import type { Circle } from './circle.types';
import type { EventOrigin } from '@/utils/event-source';

export type Event = Database['public']['Tables']['events']['Row'];
export type EventInsert = Database['public']['Tables']['events']['Insert'];
export type EventUpdate = Database['public']['Tables']['events']['Update'];

export interface EventWithRelations extends Event {
  creator: Profile | null;
  circle: Circle | null;
  is_saved?: boolean;
  /** People registered/going — populated by the feed query's embedded
   *  event_registrations(count). Absent on synthetic/preview events. */
  going_count?: number;

  // -------------------------------------------------------------------------
  // Provenance (migration 20260817200000_events_aggregated_source.sql). LIVE
  // in production — 96 of the 152 rows are aggregated — but src/types/
  // supabase.ts predates the migration, so `Event` does not carry them and
  // regenerating is a separate, riskier task. Declared here as OPTIONAL
  // rather than cast at every read: `select('*')` already returns all three,
  // and optionality is honest about the rows that don't have them (mock and
  // preview events, and anything built before the migration landed).
  //
  // Read these through src/utils/event-source.ts — never by comparing
  // `source` to a literal at a call site.
  // -------------------------------------------------------------------------

  /** NULL/absent = a person posted it in the app. `tina:<feed>` = imported by
   *  Tina's aggregator. The single discriminator. */
  source?: string | null;
  /** The originating feed's own id (iCalendar UID, RSS guid, JSON-LD @id) —
   *  what makes an import re-runnable. Null for human-posted. */
  external_id?: string | null;
  /** The public listing this row was read from: attribution, and the link
   *  back. NOT `ticket_url` — that is where you buy. */
  source_url?: string | null;
}

export interface EventFilters {
  search?: string;
  categories?: string[];
  /** Berlin neighbourhood name — matched client-side against `address`
   *  / `location_name` substring. Single-value for now. */
  neighborhood?: string;
  startDate?: string;
  endDate?: string;
  isFree?: boolean;
  /**
   * "Near me" toggle. When true, the feed filters events to within
   * `NEAR_ME_RADIUS_KM` (default 5 km) of the user's last-known coordinates.
   * Coords live separately on AppContext (`userCoords`) so the filter can
   * stay serialisable without leaking geo into URL state.
   */
  nearMe?: boolean;
  /**
   * Quick time-based filter chips. Mutually exclusive — turning one on
   * clears the other in the chip handler. `tonight` matches events whose
   * `starts_at` is today, between now and end-of-day local time.
   * `thisWeekend` matches events between the upcoming Friday 18:00 and
   * Sunday 23:59:59 local time.
   */
  tonight?: boolean;
  thisWeekend?: boolean;
  /**
   * Where the event came from. `undefined` = "All" and is the default — the
   * feed shows community and aggregated events together unless the user
   * narrows it.
   *
   *   'community'  → posted by a person in the app  (source IS NULL)
   *   'aggregated' → read off a public feed by Tina (source IS NOT NULL)
   *
   * Honoured BOTH server-side by getEvents (so any caller passing it through
   * useEvents gets a narrowed query rather than silently-ignored filter) and
   * client-side by applyChipFilters (which is the path the feed chips take,
   * so toggling doesn't refetch — same as tonight/thisWeekend/isFree).
   */
  origin?: EventOrigin;
}
