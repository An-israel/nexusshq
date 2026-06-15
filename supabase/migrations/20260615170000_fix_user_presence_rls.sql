-- "Update status" on the Profile page fails with:
--   "new row violates row-level security policy for table 'user_presence'"
--
-- use-presence.ts upserts (onConflict: "user_id") a row containing
-- workspace_id. The INSERT/UPDATE policies for user_presence (added in
-- 20260605200810) require
--   workspace_id IN (SELECT public.get_my_workspace_ids())
-- but get_my_workspace_ids() may not exist (or may be an outdated
-- definition) on this database if that migration's CREATE FUNCTION step
-- was never applied — consistent with the migration-drift issue found
-- elsewhere in this database. Re-assert the function and the
-- user_presence policies idempotently so the upsert succeeds for any
-- active workspace member.

CREATE OR REPLACE FUNCTION public.get_my_workspace_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT workspace_id FROM public.workspace_members
  WHERE user_id = auth.uid() AND is_active = true;
$$;

DROP POLICY IF EXISTS "user_presence insert" ON public.user_presence;
CREATE POLICY "user_presence insert" ON public.user_presence
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND workspace_id IN (SELECT public.get_my_workspace_ids())
  );

DROP POLICY IF EXISTS "user_presence update" ON public.user_presence;
CREATE POLICY "user_presence update" ON public.user_presence
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND workspace_id IN (SELECT public.get_my_workspace_ids())
  );

DROP POLICY IF EXISTS "user_presence select" ON public.user_presence;
CREATE POLICY "user_presence select" ON public.user_presence
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
