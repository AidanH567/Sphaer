-- Denormalises follower / following counts onto the profiles table.
--
-- Why: `getProfile()` currently runs three COUNT queries against `follows`
-- per profile load. Once the table grows past a few thousand rows the per-
-- profile query cost compounds visibly (Feed, Profile, /user/[id], every
-- EntityListSheet row that fetches a follower count). Denormalised counts
-- + a row-level trigger keep the columns in lockstep with the table.
--
-- After this migration ships, `src/services/profile.service.ts#getProfile`
-- can drop its two parallel COUNT queries against `follows` and just read
-- the columns. Tracked as a service-layer follow-up.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS followers_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count INT NOT NULL DEFAULT 0;

-- Backfill from existing follows rows. Safe because the columns have a
-- NOT NULL DEFAULT 0 — anyone reading mid-backfill sees 0, not nullable
-- garbage.
UPDATE public.profiles p
SET followers_count = sub.cnt
FROM (
  SELECT following_id AS id, COUNT(*)::INT AS cnt
  FROM public.follows
  GROUP BY following_id
) sub
WHERE p.id = sub.id;

UPDATE public.profiles p
SET following_count = sub.cnt
FROM (
  SELECT follower_id AS id, COUNT(*)::INT AS cnt
  FROM public.follows
  GROUP BY follower_id
) sub
WHERE p.id = sub.id;

-- ── Triggers ────────────────────────────────────────────────────────────────
-- AFTER INSERT bumps both sides. AFTER DELETE decrements. Uses atomic
-- `count = count + 1` arithmetic so concurrent inserts can't race.

CREATE OR REPLACE FUNCTION public.follows_update_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles
      SET following_count = following_count + 1
      WHERE id = NEW.follower_id;
    UPDATE public.profiles
      SET followers_count = followers_count + 1
      WHERE id = NEW.following_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.profiles
      SET following_count = GREATEST(0, following_count - 1)
      WHERE id = OLD.follower_id;
    UPDATE public.profiles
      SET followers_count = GREATEST(0, followers_count - 1)
      WHERE id = OLD.following_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS follows_counts_after_insert ON public.follows;
CREATE TRIGGER follows_counts_after_insert
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.follows_update_counts();

DROP TRIGGER IF EXISTS follows_counts_after_delete ON public.follows;
CREATE TRIGGER follows_counts_after_delete
  AFTER DELETE ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.follows_update_counts();
