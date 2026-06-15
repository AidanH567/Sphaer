-- Harden the SECURITY DEFINER trigger functions added 2026-06-15.
--
-- The Supabase security advisor (lints 0028/0029) flags that these trigger
-- functions are EXECUTE-able by the anon / authenticated roles via
-- /rest/v1/rpc/<fn>. In practice PostgREST refuses to invoke functions that
-- RETURN trigger, so the real exposure is low — but defence in depth is free:
-- a trigger function never needs to be callable over the REST API, and the
-- trigger itself still fires (triggers run as the table owner regardless of
-- who holds EXECUTE on the function).
--
-- check_rate_limit / prune_rate_limit_log were already revoked in
-- 20260612030000_rate_limiting.sql, so they are not repeated here.
--
-- AUTHORED + APPLIED 2026-06-15 via the Supabase integration.

REVOKE EXECUTE ON FUNCTION public.follows_update_counts() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_message_insert() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_follow_insert() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_circle_event_insert() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rate_limit_messages() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rate_limit_follows() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rate_limit_reports() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profiles_verified() FROM anon, authenticated;
