-- events_neighbourhood — denormalise the address's Berlin Ortsteil
--
-- Adds a structured `neighbourhood` column on events. Filled in by the
-- Places Autocomplete flow on Create Activity (extracted from
-- address_components.sublocality_level_1), and backfilled for the
-- seeded mock events by the seed script.
--
-- Why a column instead of substring-matching on `address`:
--   - "Kreuzbergstraße 1, Mitte" would match a Kreuzberg filter using
--     substring matching, even though the actual neighbourhood is Mitte.
--   - Future features (neighbourhood tabs, "Tonight in Kreuzberg"
--     digests, neighbourhood-grouped notifications) want a structured
--     value, not a string-match heuristic.
--
-- Nullable: events without a confidently-detected neighbourhood (no
-- address, ambiguous result, etc.) stay NULL and fall back to the
-- address-substring filter.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS neighbourhood TEXT;

CREATE INDEX IF NOT EXISTS events_neighbourhood_idx
  ON public.events (neighbourhood);
