-- Add multi-assignee support: task_assignees junction table.
--
-- assigned_to on tasks is kept as the "primary" assignee for backward
-- compatibility with reports, email workers, burnout detection, etc.
-- task_assignees tracks ALL assignees (including the primary) and is
-- the authoritative source for the UI.

CREATE TABLE IF NOT EXISTS public.task_assignees (
  task_id     uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

ALTER TABLE public.task_assignees ENABLE ROW LEVEL SECURITY;

-- Workspace members can see assignees for tasks in their workspace
CREATE POLICY "task_assignees select" ON public.task_assignees
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_assignees.task_id
        AND t.workspace_id IN (SELECT public.get_my_workspace_ids())
    )
    OR user_id = auth.uid()
  );

-- Managers/admins can add assignees
CREATE POLICY "task_assignees insert" ON public.task_assignees
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_assignees.task_id
        AND public.is_workspace_manager(t.workspace_id, auth.uid())
    )
  );

-- Managers/admins can remove assignees
CREATE POLICY "task_assignees delete" ON public.task_assignees
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_assignees.task_id
        AND public.is_workspace_manager(t.workspace_id, auth.uid())
    )
  );

-- Seed task_assignees from the existing single assigned_to column so all
-- historical tasks appear correctly in the new multi-assignee model.
INSERT INTO public.task_assignees (task_id, user_id, assigned_by)
SELECT id, assigned_to, assigned_by
FROM public.tasks
WHERE assigned_to IS NOT NULL
ON CONFLICT (task_id, user_id) DO NOTHING;

-- Tasks SELECT: extend so any task_assignee (not just workspace member) can
-- read the task they're assigned to. "ws managers view tasks" already covers
-- managers via a separate policy.
DROP POLICY IF EXISTS "tasks select" ON public.tasks;
CREATE POLICY "tasks select" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT public.get_my_workspace_ids())
    OR EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()
    )
  );

-- Tasks UPDATE: any assignee (not just the primary assigned_to) can update
-- their progress. "ws managers manage tasks" (FOR ALL) still covers managers.
DROP POLICY IF EXISTS "tasks update" ON public.tasks;
CREATE POLICY "tasks update" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.task_assignees ta
      WHERE ta.task_id = tasks.id AND ta.user_id = auth.uid()
    )
  );

-- Add to realtime so the task list refreshes when assignees change
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.task_assignees;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
