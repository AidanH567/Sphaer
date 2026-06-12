-- Verified badge — server-side flag for vetted artist profiles (Profile v2 #1)
--
-- AUTHORED ONLY — review, then apply with `npx supabase db push`.
--
-- `verified` is flipped manually by the team (SQL editor / dashboard,
-- service_role) for artists whose identity has been vetted. There is no
-- self-serve "request verification" flow by design: verification on Sphaer
-- is curation, not a paid checkmark. The client renders a green seal next
-- to the display name (ProfileView hero) only when this is TRUE — see
-- isVerified() in src/components/profile/adaptProfile.ts.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Guard: `profiles_update_own` / `profiles_insert_own`
-- (20240101000000_initial_schema.sql) let any user write their own row —
-- without this trigger anyone could self-grant the badge with one PostgREST
-- call (`update profiles set verified = true`, or a crafted first insert).
-- Rather than splitting the policies per column, a BEFORE trigger silently
-- discards client changes to `verified` unless the request runs as
-- service_role (dashboard / SQL editor sessions run as postgres, where
-- auth.role() is NULL — treat NULL/empty as trusted too). Reverting instead
-- of raising keeps ordinary profile saves (which send the whole row back)
-- from erroring.

CREATE OR REPLACE FUNCTION public.protect_profiles_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester TEXT := COALESCE(auth.role(), '');
BEGIN
  IF requester IN ('', 'service_role') THEN
    RETURN NEW; -- trusted: dashboard / SQL editor / service key
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.verified := FALSE;
  ELSIF NEW.verified IS DISTINCT FROM OLD.verified THEN
    NEW.verified := OLD.verified;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profiles_verified ON public.profiles;
CREATE TRIGGER protect_profiles_verified
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profiles_verified();

-- No backfill: nobody is verified at launch; grants are 1-by-1 via
--   UPDATE public.profiles SET verified = TRUE WHERE username = '...';
-- run with service_role.

-- AUTHORED 2026-06-12, NOT APPLIED. Apply with `npx supabase db push`,
-- then regenerate src/types/supabase.ts (the client reads the column via a
-- narrow runtime probe until types are regenerated — see isVerified()).
