-- activities_v2 — Real activity/circle creation + registrations
--
-- Adds the event_registrations table, two auto-side-effect triggers
-- (register-creator-on-event-insert, admin-creator-on-circle-insert), and
-- the circle-images storage bucket. Run via the Supabase dashboard SQL editor.
--
-- See: design grilling Q1–Q6 in the activities/circles conversation.
-- See: BACKLOG.md for what was explicitly *not* added here.

-- ───────────────────────────────────────────────────────────────
-- event_registrations: "I'm going to this activity"
-- Hard-delete on cancel (no status enum). quantity allows multi-ticket booking.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_registrations (
  event_id      uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quantity      integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  registered_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS event_registrations_user_idx
  ON public.event_registrations (user_id);

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_registrations_read_all"   ON public.event_registrations FOR SELECT USING (TRUE);
CREATE POLICY "event_registrations_insert_own" ON public.event_registrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "event_registrations_update_own" ON public.event_registrations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "event_registrations_delete_own" ON public.event_registrations FOR DELETE USING (auth.uid() = user_id);

-- ───────────────────────────────────────────────────────────────
-- Trigger: auto-register the creator of a new event
-- Guarantees creator counts toward profile activities + appears in attendees.
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_event_creator()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.event_registrations (event_id, user_id, quantity)
  VALUES (NEW.id, NEW.creator_id, 1)
  ON CONFLICT (event_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_event_created ON public.events;
CREATE TRIGGER on_event_created
  AFTER INSERT ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.register_event_creator();

-- ───────────────────────────────────────────────────────────────
-- Trigger: auto-add the creator as admin member of a new circle
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_circle_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.circle_members (circle_id, user_id, role)
  VALUES (NEW.id, NEW.creator_id, 'admin')
  ON CONFLICT (circle_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_circle_created ON public.circles;
CREATE TRIGGER on_circle_created
  AFTER INSERT ON public.circles
  FOR EACH ROW EXECUTE FUNCTION public.add_circle_creator_as_admin();

-- ───────────────────────────────────────────────────────────────
-- circle-images storage bucket (avatars + covers)
-- Path scheme: <user_id>/<filename> — matches existing bucket convention
-- ───────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('circle-images', 'circle-images', TRUE)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "circle_images_read"   ON storage.objects FOR SELECT USING (bucket_id = 'circle-images');
CREATE POLICY "circle_images_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'circle-images' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "circle_images_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'circle-images' AND auth.uid()::text = (storage.foldername(name))[1]
);
CREATE POLICY "circle_images_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'circle-images' AND auth.uid()::text = (storage.foldername(name))[1]
);
