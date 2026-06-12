-- ───────────────────────────────────────────────────────────────
-- Storage: server-side MIME allowlist + size cap on all image buckets
--
-- Defense in depth for uploads. The client already validates type and
-- size (src/utils/upload-validation.ts), but that only guards the app —
-- anyone with the anon key can hit the Storage API directly and the
-- bucket-level path RLS says nothing about content type or size. Setting
-- `allowed_mime_types` / `file_size_limit` on storage.buckets makes the
-- Storage service itself reject bad uploads at request time.
--
-- Buckets covered (all four image buckets that exist today):
--   avatars, profile-gallery, event-posters   (20260527000000_profile_v2)
--   circle-images                             (20260527010000_activities_v2)
--
-- Allowlist mirrors ALLOWED_IMAGE_MIME in src/utils/upload-validation.ts
-- EXACTLY — including the non-standard 'image/jpg' (some RN pickers emit
-- it, and every service passes `contentType: blob.type` straight through,
-- so the bucket must accept it) and 'image/gif' (explicitly allowed
-- client-side for gallery/poster art). Dropping either here would hard-
-- fail uploads the client legitimately permits.
--
-- file_size_limit = 10485760 bytes (10 MB) = MAX_UPLOAD_BYTES, the
-- client-side cap. Note storage.buckets.file_size_limit is BIGINT bytes.
--
-- Existing objects are untouched — these settings only gate new uploads.
--
-- Idempotent + safe everywhere:
--   * re-running just re-sets the same values;
--   * if a bucket id doesn't exist in some environment, the UPDATE
--     simply matches 0 rows — no error, no bucket created;
--   * buckets are intentionally NOT (re)created here.
--
-- If `db push` ever reports "permission denied for table buckets" on a
-- hosted project (storage schema ownership tightened in newer Supabase
-- releases), set the same two values per bucket via Dashboard → Storage
-- → <bucket> → Edit instead; they are the identical underlying columns.
-- ───────────────────────────────────────────────────────────────

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
      'image/jpeg',
      'image/jpg',   -- non-standard variant some RN clients send; client allows it
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif',
      'image/gif'
    ],
    file_size_limit = 10485760  -- 10 MB, matches MAX_UPLOAD_BYTES client-side
WHERE id IN (
  'avatars',
  'profile-gallery',
  'event-posters',
  'circle-images'
);

-- AUTHORED 2026-06-12, NOT APPLIED. Apply with `npx supabase db push`,
-- then regenerate src/types/supabase.ts.
