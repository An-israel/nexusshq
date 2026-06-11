
-- 1. Deliverables storage: workspace-scoped manager read
DROP POLICY IF EXISTS "managers view all deliverable files" ON storage.objects;
CREATE POLICY "ws managers view deliverable files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'deliverables'
  AND EXISTS (
    SELECT 1 FROM public.deliverables d
    WHERE d.storage_path = storage.objects.name
      AND d.workspace_id IS NOT NULL
      AND public.is_workspace_manager(d.workspace_id, auth.uid())
  )
);

-- 2. profiles: workspace-scoped admin/manager updates
-- Define can_manage_private_profile before the policy that uses it; the
-- original version of this migration referenced it without defining it,
-- which fails on a fresh replay. 20260609070000 redefines it via
-- CREATE OR REPLACE, so this stays in sync.
CREATE OR REPLACE FUNCTION public.can_manage_private_profile(target_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm_caller
    JOIN public.workspace_members wm_target
      ON wm_caller.workspace_id = wm_target.workspace_id
    WHERE wm_caller.user_id = auth.uid()
      AND wm_caller.is_active = true
      AND wm_caller.role IN ('owner', 'admin', 'manager')
      AND wm_target.user_id = target_user_id
      AND wm_target.is_active = true
  );
$$;

DROP POLICY IF EXISTS "admins update any profile" ON public.profiles;
DROP POLICY IF EXISTS "managers update employee profiles" ON public.profiles;
CREATE POLICY "ws admins update shared profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (public.can_manage_private_profile(id))
WITH CHECK (public.can_manage_private_profile(id));

-- 3. realtime.messages: restrict to active workspace members
DROP POLICY IF EXISTS "authenticated can receive realtime" ON realtime.messages;
CREATE POLICY "active members can receive realtime"
ON realtime.messages FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- 4. channel_members: restrict insert/delete
DROP POLICY IF EXISTS "channel_members insert" ON public.channel_members;
DROP POLICY IF EXISTS "channel_members delete" ON public.channel_members;
CREATE POLICY "channel_members insert"
ON public.channel_members FOR INSERT TO authenticated
WITH CHECK (
  workspace_id IN (SELECT public.get_my_workspace_ids())
  AND (
    public.is_workspace_manager(workspace_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.channels c
      WHERE c.id = channel_id
        AND (
          c.created_by = auth.uid()
          OR (c.type IN ('public','announcement') AND user_id = auth.uid())
        )
    )
  )
);
CREATE POLICY "channel_members delete"
ON public.channel_members FOR DELETE TO authenticated
USING (
  workspace_id IN (SELECT public.get_my_workspace_ids())
  AND (
    user_id = auth.uid()
    OR public.is_workspace_manager(workspace_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.channels c WHERE c.id = channel_id AND c.created_by = auth.uid())
  )
);

-- 5. channels: restrict update/delete to creators or workspace managers
DROP POLICY IF EXISTS "channels update" ON public.channels;
DROP POLICY IF EXISTS "channels delete" ON public.channels;
CREATE POLICY "channels update"
ON public.channels FOR UPDATE TO authenticated
USING (
  workspace_id IN (SELECT public.get_my_workspace_ids())
  AND (created_by = auth.uid() OR public.is_workspace_manager(workspace_id, auth.uid()))
);
CREATE POLICY "channels delete"
ON public.channels FOR DELETE TO authenticated
USING (
  workspace_id IN (SELECT public.get_my_workspace_ids())
  AND (created_by = auth.uid() OR public.is_workspace_manager(workspace_id, auth.uid()))
);

-- 6. client_projects / client_project_tasks: NOT NULL workspace_id and drop NULL branch
ALTER TABLE public.client_projects ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.client_project_tasks ALTER COLUMN workspace_id SET NOT NULL;
DROP POLICY IF EXISTS "managers read client projects" ON public.client_projects;
DROP POLICY IF EXISTS "managers read client tasks" ON public.client_project_tasks;

-- 7. has_role cross-tenant fixes
-- leave_types
DROP POLICY IF EXISTS "managers manage leave types" ON public.leave_types;
CREATE POLICY "ws managers manage leave types"
ON public.leave_types FOR ALL TO authenticated
USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()))
WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

-- wiki_sections
DROP POLICY IF EXISTS "managers manage wiki sections" ON public.wiki_sections;
CREATE POLICY "ws managers manage wiki sections"
ON public.wiki_sections FOR ALL TO authenticated
USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()))
WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

-- objectives
DROP POLICY IF EXISTS "managers manage objectives" ON public.objectives;
CREATE POLICY "ws managers manage objectives"
ON public.objectives FOR ALL TO authenticated
USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()))
WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

-- task_updates
DROP POLICY IF EXISTS "view updates of own tasks" ON public.task_updates;
DROP POLICY IF EXISTS "insert updates for own/managed tasks" ON public.task_updates;
CREATE POLICY "view task updates scoped"
ON public.task_updates FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_updates.task_id
      AND (
        t.assigned_to = auth.uid()
        OR (t.workspace_id IS NOT NULL AND public.is_workspace_manager(t.workspace_id, auth.uid()))
      )
  )
);
CREATE POLICY "insert task updates scoped"
ON public.task_updates FOR INSERT TO authenticated
WITH CHECK (
  updated_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = task_updates.task_id
      AND (
        t.assigned_to = auth.uid()
        OR (t.workspace_id IS NOT NULL AND public.is_workspace_manager(t.workspace_id, auth.uid()))
      )
  )
);

-- notifications: scope manager-created notifications to shared workspace
DROP POLICY IF EXISTS "managers/admins create notifications" ON public.notifications;
CREATE POLICY "create notifications scoped"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.shares_workspace_with(user_id, auth.uid())
);

-- client_portal_views: scope manager reads to their workspaces
DROP POLICY IF EXISTS "managers view portal views" ON public.client_portal_views;
CREATE POLICY "ws managers view portal views"
ON public.client_portal_views FOR SELECT TO authenticated
USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

-- key_results: scope insert/delete to workspace managers
DROP POLICY IF EXISTS "managers insert/delete key results" ON public.key_results;
DROP POLICY IF EXISTS "managers delete key results" ON public.key_results;
CREATE POLICY "ws managers insert key results"
ON public.key_results FOR INSERT TO authenticated
WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));
CREATE POLICY "ws managers delete key results"
ON public.key_results FOR DELETE TO authenticated
USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));
