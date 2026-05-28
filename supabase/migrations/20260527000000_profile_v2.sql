-- profile_v2 — Real user profile data
--
-- Adds the columns and table needed to wire up the personal profile page
-- against real authed users (vs the previous mock-data-only flow). Run via
-- the Supabase dashboard SQL editor.
--
-- See: design grilling Q1–Q10 in the May 2026 profile/auth conversation.
-- See: BACKLOG.md for what was explicitly *not* added here.

-- ───────────────────────────────────────────────────────────────
-- profiles: add text and structured fields
-- ───────────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS about        TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS experiences  JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ───────────────────────────────────────────────────────────────
-- profile_images: gallery (one row per image, JSONB rejected to
-- keep the door open for likes/comments on individual photos later)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profile_images (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  path       TEXT NOT NULL,          -- storage path in profile-gallery bucket
  caption    TEXT,                   -- nullable, no UI yet
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS profile_images_profile_idx
  ON public.profile_images (profile_id, sort_order);

ALTER TABLE public.profile_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profile_images_read_all"    ON public.profile_images FOR SELECT USING (TRUE);
CREATE POLICY "profile_images_insert_own"  ON public.profile_images FOR INSERT WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "profile_images_update_own"  ON public.profile_images FOR UPDATE USING (auth.uid() = profile_id);
CREATE POLICY "profile_images_delete_own"  ON public.profile_images FOR DELETE USING (auth.uid() = profile_id);

-- ───────────────────────────────────────────────────────────────
-- Trigger: copy display_name from signup metadata (was: username)
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data ->> 'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- (trigger on_auth_user_created already exists and stays as-is)

-- ───────────────────────────────────────────────────────────────
-- Storage buckets: avatars, profile-gallery, event-posters
-- ───────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars',         'avatars',         TRUE),
  ('profile-gallery', 'profile-gallery', TRUE),
  ('event-posters',   'event-posters',   TRUE)
ON CONFLICT (id) DO NOTHING;

-- Bucket RLS: anyone can read, owner of the folder can write
-- Path scheme: <user_id>/<filename>
CREATE POLICY "avatars_read"   ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "gallery_read"   ON storage.objects FOR SELECT USING (bucket_id = 'profile-gallery');
CREATE POLICY "gallery_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'profile-gallery' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "gallery_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'profile-gallery' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "gallery_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'profile-gallery' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "posters_read"   ON storage.objects FOR SELECT USING (bucket_id = 'event-posters');
CREATE POLICY "posters_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'event-posters' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "posters_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'event-posters' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "posters_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'event-posters' AND auth.uid()::text = (storage.foldername(name))[1]
);
