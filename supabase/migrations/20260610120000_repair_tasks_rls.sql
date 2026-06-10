-- Repair public.tasks RLS so admins/managers can insert tasks regardless of
-- which prior migration state the database is currently in. Re-asserts the
-- canonical multi-tenant policies and helper functions idempotently.

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

-- Drop every historical policy name that has ever existed on public.tasks
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

-- Canonical multi-tenant policy set
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
