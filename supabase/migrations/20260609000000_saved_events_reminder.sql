-- Adds a per-save reminder timestamp to `saved_events`.
--
-- The producer side — a scheduled job that scans for `reminder_at` values
-- coming due in the next 15 minutes and enqueues `notifications` rows of
-- type `event_reminder` — is intentionally NOT shipped in this migration.
-- That half lands once push notifications are wired (P2 backlog item).
-- Until then the column is read-only forward-compat scaffolding.
--
-- Default policy: each save triggers a reminder 2 hours before
-- `events.starts_at`. The default is computed and applied by the client
-- on save (NOT by a DB trigger, so the user can override it without
-- racing the server). Existing rows are left NULL (no reminder set —
-- avoid spamming notifications for events users saved long ago).

ALTER TABLE public.saved_events
  ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ;

-- Index supports the scheduled job's WHERE clause once it ships:
--   WHERE reminder_at IS NOT NULL AND reminder_at <= now() + interval '15 min'
-- Partial index so we only index rows that actually have a reminder set.
CREATE INDEX IF NOT EXISTS saved_events_reminder_at_idx
  ON public.saved_events (reminder_at)
  WHERE reminder_at IS NOT NULL;
