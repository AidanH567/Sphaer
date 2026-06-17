-- Lara Figma audit #6: let artists add social links to their profile.
-- Additive + nullable, so existing rows and inserts are unaffected.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS instagram text,
  ADD COLUMN IF NOT EXISTS linkedin text;

COMMENT ON COLUMN public.profiles.instagram IS 'Instagram handle or URL (free text).';
COMMENT ON COLUMN public.profiles.linkedin IS 'LinkedIn handle or URL (free text).';
