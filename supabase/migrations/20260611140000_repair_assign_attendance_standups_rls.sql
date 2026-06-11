-- Repair RLS for task assignment, attendance, and standups so that ANY active
-- workspace member (including admins/managers, not just the owner) can:
--   * create/assign tasks within their workspace
--   * view their own attendance and standups
-- ...and so that admins/managers (owner/admin/manager) can additionally:
--   * view and manage attendance for everyone in the workspace
--   * view standups for everyone in the workspace
--   * manage (assign/update/delete) tasks for everyone in the workspace
--
-- This re-asserts the canonical policy set idempotently in case earlier
-- repair migrations were not fully applied to this database.

CREATE OR REPLACE FUNCTION public.get_my_workspace_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT workspace_id FROM public.workspace_members
  WHERE user_id = auth.uid() AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_manager(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND is_active = true
      AND role IN ('owner','admin','manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND is_active = true
      AND role IN ('owner','admin')
  );
$$;

-- ===== tasks =====
DROP POLICY IF EXISTS "employees view own tasks" ON public.tasks;
DROP POLICY IF EXISTS "employees update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "managers/admins view all tasks" ON public.tasks;
DROP POLICY IF EXISTS "managers/admins manage tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks visible to assigned user or manager" ON public.tasks;
DROP POLICY IF EXISTS "managers can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "managers can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "assigned users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "managers can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks select" ON public.tasks;
DROP POLICY IF EXISTS "tasks insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks update" ON public.tasks;
DROP POLICY IF EXISTS "tasks delete" ON public.tasks;
DROP POLICY IF EXISTS "ws managers manage tasks" ON public.tasks;
DROP POLICY IF EXISTS "ws managers view tasks" ON public.tasks;

CREATE POLICY "tasks select" ON public.tasks
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

CREATE POLICY "tasks insert" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));

CREATE POLICY "tasks update" ON public.tasks
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));

CREATE POLICY "tasks delete" ON public.tasks
  FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

CREATE POLICY "ws managers manage tasks" ON public.tasks
  FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

CREATE POLICY "ws managers view tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

-- ===== recurring_tasks =====
DROP POLICY IF EXISTS "managers manage recurring" ON public.recurring_tasks;
DROP POLICY IF EXISTS "managers view all recurring" ON public.recurring_tasks;
DROP POLICY IF EXISTS "ws managers manage recurring" ON public.recurring_tasks;
DROP POLICY IF EXISTS "ws managers view recurring" ON public.recurring_tasks;

CREATE POLICY "ws managers manage recurring" ON public.recurring_tasks
  FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

CREATE POLICY "ws managers view recurring" ON public.recurring_tasks
  FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

-- ===== notifications: managers/admins can notify members of their workspace =====
DROP POLICY IF EXISTS "managers/admins create notifications" ON public.notifications;
DROP POLICY IF EXISTS "create notifications scoped" ON public.notifications;
CREATE POLICY "create notifications scoped"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.shares_workspace_with(user_id, auth.uid())
);

-- ===== attendance =====
DROP POLICY IF EXISTS "attendance select" ON public.attendance;
DROP POLICY IF EXISTS "attendance insert" ON public.attendance;
DROP POLICY IF EXISTS "attendance update" ON public.attendance;
DROP POLICY IF EXISTS "attendance delete" ON public.attendance;
DROP POLICY IF EXISTS "Users can view own attendance or managers all" ON public.attendance;
DROP POLICY IF EXISTS "Users can insert own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can update own attendance" ON public.attendance;
DROP POLICY IF EXISTS "attendance readable by user and managers" ON public.attendance;
DROP POLICY IF EXISTS "attendance insertable by authenticated" ON public.attendance;
DROP POLICY IF EXISTS "attendance updatable by user and managers" ON public.attendance;
DROP POLICY IF EXISTS "admins manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "managers/admins view all attendance" ON public.attendance;
DROP POLICY IF EXISTS "ws managers manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "ws managers view attendance" ON public.attendance;

CREATE POLICY "attendance select" ON public.attendance FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "attendance insert" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "attendance update" ON public.attendance FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()))
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "attendance delete" ON public.attendance FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

CREATE POLICY "ws managers manage attendance" ON public.attendance
  FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));
CREATE POLICY "ws managers view attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

-- ===== standups =====
DROP POLICY IF EXISTS "users view own standups" ON public.standups;
DROP POLICY IF EXISTS "users create standups" ON public.standups;
DROP POLICY IF EXISTS "users update own standups" ON public.standups;
DROP POLICY IF EXISTS "managers view all standups" ON public.standups;
DROP POLICY IF EXISTS "standups select" ON public.standups;
DROP POLICY IF EXISTS "standups insert" ON public.standups;
DROP POLICY IF EXISTS "standups update" ON public.standups;
DROP POLICY IF EXISTS "standups delete" ON public.standups;
DROP POLICY IF EXISTS "standups readable by workspace" ON public.standups;
DROP POLICY IF EXISTS "standups insertable by authenticated" ON public.standups;
DROP POLICY IF EXISTS "standups updatable by owner or manager" ON public.standups;
DROP POLICY IF EXISTS "ws managers view standups" ON public.standups;

CREATE POLICY "standups select" ON public.standups FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "standups insert" ON public.standups FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND workspace_id IN (SELECT public.get_my_workspace_ids())
  );
CREATE POLICY "standups update" ON public.standups FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "standups delete" ON public.standups FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "ws managers view standups" ON public.standups
  FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));
