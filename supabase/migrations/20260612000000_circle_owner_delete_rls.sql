-- ───────────────────────────────────────────────────────────────
-- Circle owner moderation RLS (BACKLOG audit 2026-06-11, items 1 & 2)
--
-- AUTHORED ONLY — review, then apply with `npx supabase db push`.
--
-- 1. circles_delete_own
--    The initial schema (20240101000000) created SELECT / INSERT / UPDATE
--    policies for `circles` but no DELETE policy, so RLS filtered every
--    `DELETE FROM circles` down to zero rows — the "Delete circle" flow
--    would silently do nothing without this.
--
-- 2. circle_members_creator_delete
--    `circle_members_delete` only allows `auth.uid() = user_id` (a member
--    removing their own row, i.e. leaving). The member-kick flow needs the
--    circle *creator* to delete other members' rows. Permissive policies
--    OR together, so voluntary leave keeps working unchanged.
--
-- FK behaviour on circle delete (already in the initial schema):
--   circle_members   ON DELETE CASCADE
--   circle_follows   ON DELETE CASCADE
--   messages         ON DELETE CASCADE  (the circle's chat)
--   events.circle_id ON DELETE SET NULL (activities become independent)
-- ───────────────────────────────────────────────────────────────

-- Creators can delete their own circle.
CREATE POLICY "circles_delete_own" ON public.circles
  FOR DELETE USING (auth.uid() = creator_id);

-- Circle creators can remove (kick) members from circles they created.
-- The subquery passes the creator's own-row SELECT policy on circles, and
-- circles' policies never reference circle_members, so no RLS recursion.
CREATE POLICY "circle_members_creator_delete" ON public.circle_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.circles c
      WHERE c.id = circle_members.circle_id
        AND c.creator_id = auth.uid()
    )
  );
