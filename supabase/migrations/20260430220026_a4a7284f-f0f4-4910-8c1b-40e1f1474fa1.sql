-- Restrict execution of SECURITY DEFINER helpers to internal roles only.
-- They keep working inside triggers and RLS policies (which run as the function owner / postgres).
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon, authenticated;