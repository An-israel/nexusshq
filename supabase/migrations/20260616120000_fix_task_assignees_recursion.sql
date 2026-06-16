-- "infinite recursion detected in policy for relation 'tasks'"
--
-- Root cause: tasks SELECT policy → queries task_assignees →
-- task_assignees SELECT policy → queries tasks → repeat.
--
-- Fix: add workspace_id to task_assignees (denormalised, kept in sync via
-- the FK cascade on tasks.workspace_id) so its policies can check workspace
-- membership directly without touching the tasks table. Then simplify the
-- tasks SELECT policy to remove the task_assignees reference entirely — all
-- active workspace members are already covered by get_my_workspace_ids().

ALTER TABLE public.task_assignees
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

UPDATE public.task_assignees ta
SET workspace_id = (SELECT t.workspace_id FROM public.tasks t WHERE t.id = ta.task_id)
WHERE ta.workspace_id IS NULL;

-- Rebuild task_assignees policies without any tasks reference
DROP POLICY IF EXISTS "task_assignees select" ON public.task_assignees;
CREATE POLICY "task_assignees select" ON public.task_assignees
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

DROP POLICY IF EXISTS "task_assignees insert" ON public.task_assignees;
CREATE POLICY "task_assignees insert" ON public.task_assignees
  FOR INSERT TO authenticated
  WITH CHECK (public.is_workspace_manager(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "task_assignees delete" ON public.task_assignees;
CREATE POLICY "task_assignees delete" ON public.task_assignees
  FOR DELETE TO authenticated
  USING (public.is_workspace_manager(workspace_id, auth.uid()));

-- Simplify tasks SELECT: remove task_assignees reference — get_my_workspace_ids()
-- already covers every active workspace member (including secondary assignees).
DROP POLICY IF EXISTS "tasks select" ON public.tasks;
CREATE POLICY "tasks select" ON public.tasks
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
