
-- 1. Cross-tenant readable tables: scope SELECT to workspace membership

DROP POLICY IF EXISTS "all auth view announcements" ON public.announcements;
CREATE POLICY "members view announcements"
ON public.announcements FOR SELECT TO authenticated
USING (workspace_id IS NULL OR workspace_id IN (SELECT public.get_my_workspace_ids()));

DROP POLICY IF EXISTS "all auth view kpis" ON public.kpis;
CREATE POLICY "members view kpis"
ON public.kpis FOR SELECT TO authenticated
USING (workspace_id IS NULL OR workspace_id IN (SELECT public.get_my_workspace_ids()));

DROP POLICY IF EXISTS "auth view leave types" ON public.leave_types;
CREATE POLICY "members view leave types"
ON public.leave_types FOR SELECT TO authenticated
USING (workspace_id IS NULL OR workspace_id IN (SELECT public.get_my_workspace_ids()));

DROP POLICY IF EXISTS "auth view wiki pages" ON public.wiki_pages;
CREATE POLICY "members view wiki pages"
ON public.wiki_pages FOR SELECT TO authenticated
USING (workspace_id IS NULL OR workspace_id IN (SELECT public.get_my_workspace_ids()));

DROP POLICY IF EXISTS "auth view wiki sections" ON public.wiki_sections;
CREATE POLICY "members view wiki sections"
ON public.wiki_sections FOR SELECT TO authenticated
USING (workspace_id IS NULL OR workspace_id IN (SELECT public.get_my_workspace_ids()));

DROP POLICY IF EXISTS "auth view standup comments" ON public.standup_comments;
CREATE POLICY "members view standup comments"
ON public.standup_comments FOR SELECT TO authenticated
USING (workspace_id IS NULL OR workspace_id IN (SELECT public.get_my_workspace_ids()));

DROP POLICY IF EXISTS "auth view objectives" ON public.objectives;
CREATE POLICY "members view objectives"
ON public.objectives FOR SELECT TO authenticated
USING (workspace_id IS NULL OR workspace_id IN (SELECT public.get_my_workspace_ids()));

DROP POLICY IF EXISTS "auth view key result updates" ON public.key_result_updates;
CREATE POLICY "members view key result updates"
ON public.key_result_updates FOR SELECT TO authenticated
USING (workspace_id IS NULL OR workspace_id IN (SELECT public.get_my_workspace_ids()));


-- 2. client_projects: restrict full-row reads (including access_token) to managers/admins
DROP POLICY IF EXISTS "workspace members read client projects" ON public.client_projects;
CREATE POLICY "managers read client projects"
ON public.client_projects FOR SELECT TO authenticated
USING (
  (workspace_id IS NULL AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)))
  OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = client_projects.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.is_active = true
      AND wm.role IN ('owner','admin','manager')
  )
);

-- Same for client_project_tasks (tightened to match)
DROP POLICY IF EXISTS "workspace members read client tasks" ON public.client_project_tasks;
CREATE POLICY "managers read client tasks"
ON public.client_project_tasks FOR SELECT TO authenticated
USING (
  (workspace_id IS NULL AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role)))
  OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = client_project_tasks.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.is_active = true
      AND wm.role IN ('owner','admin','manager')
  )
);


-- 3. workspace_invitations: restrict reads (token/passcode) to managers/admins only
DROP POLICY IF EXISTS "invitations select" ON public.workspace_invitations;
CREATE POLICY "managers read invitations"
ON public.workspace_invitations FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = workspace_invitations.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.is_active = true
      AND wm.role IN ('owner','admin','manager')
  )
);


-- 4. Storage: avatars bucket — remove unrestricted delete/update
DROP POLICY IF EXISTS "avatars delete" ON storage.objects;
DROP POLICY IF EXISTS "avatars update" ON storage.objects;

CREATE POLICY "users delete own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "admins delete group avatars"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'groups'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
);

CREATE POLICY "admins update group avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'groups'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
);


-- 5. Storage: message-attachments — only workspace members of the related message can read
DROP POLICY IF EXISTS "msg attachments auth read" ON storage.objects;

CREATE POLICY "msg attachments member read"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'message-attachments'
  AND EXISTS (
    SELECT 1
    FROM public.message_attachments ma
    JOIN public.messages m ON m.id = ma.message_id
    WHERE ma.storage_path = storage.objects.name
      AND m.workspace_id IN (SELECT public.get_my_workspace_ids())
  )
);
