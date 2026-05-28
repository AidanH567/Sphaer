-- oauth_trigger_fallback — handle_new_user reads Google's metadata fields
--
-- Email signup sets `display_name` in raw_user_meta_data.
-- Google OAuth sets `full_name` / `name` / `avatar_url` / `picture` instead.
-- COALESCE lets one trigger serve both providers. Also pulls in the avatar
-- if the provider supplied one — saves the user a step on first launch.
--
-- Idempotent: CREATE OR REPLACE rebinds the function; the trigger keeps
-- pointing at it.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'display_name',  -- our email signup
      NEW.raw_user_meta_data ->> 'full_name',     -- Google
      NEW.raw_user_meta_data ->> 'name'           -- Google (older shape)
    ),
    COALESCE(
      NEW.raw_user_meta_data ->> 'avatar_url',    -- Google (post-2023)
      NEW.raw_user_meta_data ->> 'picture'        -- Google (older shape)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- The on_auth_user_created trigger already exists and continues pointing
-- at handle_new_user — no need to drop/recreate.
