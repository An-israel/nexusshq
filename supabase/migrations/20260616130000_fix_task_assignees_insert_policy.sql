-- "new row violates row-level security policy for table 'task_assignees'"
--
-- The task_assignees INSERT/DELETE policies either:
--   a) joined tasks with RLS applied → infinite recursion surfacing as RLS error, or
--   b) relied on workspace_id column not yet present in the live DB.
--
-- Fix: create a SECURITY DEFINER function is_task_manager() that queries
-- tasks + workspace_members directly (bypassing RLS) so it is safe to call
-- from any policy without causing recursion. Also ensure workspace_id column
-- exists and the SELECT policy is non-recursive (idempotent re-run of 20260616120000).

ALTER TABLE public.task_assignees
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

UPDATE public.task_assignees ta
SET workspace_id = (SELECT t.workspace_id FROM public.tasks t WHERE t.id = ta.task_id)
WHERE ta.workspace_id IS NULL;

-- SECURITY DEFINER: bypasses RLS on tasks/workspace_members so it is safe
-- to call from any policy without triggering recursive policy evaluation.
CREATE OR REPLACE FUNCTION public.is_task_manager(_task_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    JOIN public.workspace_members wm ON wm.workspace_id = t.workspace_id
    WHERE t.id = _task_id
      AND wm.user_id = _user_id
      AND wm.is_active = true
      AND wm.role IN ('owner', 'admin', 'manager')
  );
$$;

-- Rebuild all task_assignees policies using non-recursive helpers
DROP POLICY IF EXISTS "task_assignees select" ON public.task_assignees;
CREATE POLICY "task_assignees select" ON public.task_assignees
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

DROP POLICY IF EXISTS "task_assignees insert" ON public.task_assignees;
CREATE POLICY "task_assignees insert" ON public.task_assignees
  FOR INSERT TO authenticated
  WITH CHECK (public.is_task_manager(task_id, auth.uid()));

DROP POLICY IF EXISTS "task_assignees delete" ON public.task_assignees;
CREATE POLICY "task_assignees delete" ON public.task_assignees
  FOR DELETE TO authenticated
  USING (public.is_task_manager(task_id, auth.uid()));

-- Ensure tasks SELECT is also non-recursive (idempotent)
DROP POLICY IF EXISTS "tasks select" ON public.tasks;
CREATE POLICY "tasks select" ON public.tasks
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
