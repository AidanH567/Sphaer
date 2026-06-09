import type { Database } from './supabase';
import type { Profile } from './user.types';
import type { Circle } from './circle.types';

export type Event = Database['public']['Tables']['events']['Row'];
export type EventInsert = Database['public']['Tables']['events']['Insert'];
export type EventUpdate = Database['public']['Tables']['events']['Update'];

export interface EventWithRelations extends Event {
  creator: Profile | null;
  circle: Circle | null;
  is_saved?: boolean;
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
}
