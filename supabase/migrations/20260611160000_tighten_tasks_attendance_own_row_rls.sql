-- Tighten the "any active workspace member" update/delete policies on tasks
-- and attendance added in 20260611140000. Those policies let ANY active
-- member update or delete ANY OTHER member's task or attendance row, as
-- long as it's in the same workspace. Restrict the general member-level
-- policies to the user's own rows; managers/admins keep workspace-wide
-- access via the existing "ws managers manage tasks"/"ws managers manage
-- attendance" FOR ALL policies.

DROP POLICY IF EXISTS "tasks update" ON public.tasks;
DROP POLICY IF EXISTS "tasks delete" ON public.tasks;

CREATE POLICY "tasks update" ON public.tasks
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()) AND assigned_to = auth.uid())
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()) AND assigned_to = auth.uid());

CREATE POLICY "tasks delete" ON public.tasks
  FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()) AND assigned_to = auth.uid());

DROP POLICY IF EXISTS "attendance update" ON public.attendance;
DROP POLICY IF EXISTS "attendance delete" ON public.attendance;

CREATE POLICY "attendance update" ON public.attendance FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()) AND user_id = auth.uid())
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()) AND user_id = auth.uid());

CREATE POLICY "attendance delete" ON public.attendance FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()) AND user_id = auth.uid());
