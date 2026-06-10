/**
 * Image-upload guardrails. Shared by every storage upload path
 * (avatars, gallery, event posters, circle images).
 *
 * Why: bucket RLS limits write to `<userId>/...` paths, but doesn't
 * constrain content type or size. Without these checks a user could
 * upload an .exe renamed .jpg (Content-Type would be application/*
 * but we'd still accept it), or a 200 MB image (cheap denial-of-
 * service against our storage quota).
 *
 * Today we validate two things:
 *  1. `blob.type` is in the allowlist
 *  2. `blob.size` is under MAX_UPLOAD_BYTES
 *
 * Tomorrow a follow-up could add magic-byte sniffing (the first
 * 12 bytes of a JPEG always start `FF D8 FF`, PNG starts
 * `89 50 4E 47`, WebP starts `52 49 46 46 ?? ?? ?? ?? 57 45 42 50`)
 * to defeat a renamed .exe whose Content-Type was manually spoofed.
 * Scope-creep for v1; tracked in BACKLOG.
 */

const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg', // some clients send the non-standard 'image/jpg' variant
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
]);

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadValidationError';
  }
}

/**
 * Validate a Blob before uploading to Supabase Storage. Throws an
 * `UploadValidationError` with a user-friendly message on failure —
 * the caller should let the error bubble to the UI so a screen-level
 * Alert / inline error can surface it.
 */
export function validateImageUpload(blob: Blob): void {
  const type = (blob.type ?? '').toLowerCase();
  if (!type) {
    // Some RN platforms return a Blob with an empty type. We can't
    // safely guess so we reject — the picker library should always
    // produce a typed blob for the supported formats below.
    throw new UploadValidationError(
      "Couldn't read the image file type. Try selecting a different photo.",
    );
  }
  if (!ALLOWED_IMAGE_MIME.has(type)) {
    throw new UploadValidationError(
      `Unsupported image type "${type}". Sphaer supports JPEG, PNG, WebP, HEIC, and GIF.`,
    );
  }
  if (blob.size > MAX_UPLOAD_BYTES) {
    const mb = (blob.size / 1024 / 1024).toFixed(1);
    const maxMb = MAX_UPLOAD_BYTES / 1024 / 1024;
    throw new UploadValidationError(
      `That image is ${mb} MB — too large. Please pick one under ${maxMb} MB.`,
    );
  }
}
