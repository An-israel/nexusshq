
-- 1 & 2: Group avatar storage policies - scope to group's workspace
DROP POLICY IF EXISTS "auth upload group avatars" ON storage.objects;
DROP POLICY IF EXISTS "admins update group avatars" ON storage.objects;
DROP POLICY IF EXISTS "admins delete group avatars" ON storage.objects;

CREATE POLICY "ws admins upload group avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'groups'
  AND EXISTS (
    SELECT 1 FROM public.message_groups mg
    WHERE mg.id::text = (storage.foldername(name))[2]
      AND public.is_workspace_manager(mg.workspace_id, auth.uid())
  )
);

CREATE POLICY "ws admins update group avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'groups'
  AND EXISTS (
    SELECT 1 FROM public.message_groups mg
    WHERE mg.id::text = (storage.foldername(name))[2]
      AND public.is_workspace_manager(mg.workspace_id, auth.uid())
  )
);

CREATE POLICY "ws admins delete group avatars"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'groups'
  AND EXISTS (
    SELECT 1 FROM public.message_groups mg
    WHERE mg.id::text = (storage.foldername(name))[2]
      AND public.is_workspace_manager(mg.workspace_id, auth.uid())
  )
);

-- 3: client_portal_views - require project exists & workspace_id matches
DROP POLICY IF EXISTS "anyone insert portal view" ON public.client_portal_views;

CREATE POLICY "insert portal view for real project"
ON public.client_portal_views FOR INSERT TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.client_projects cp
    WHERE cp.id = client_portal_views.project_id
      AND cp.workspace_id = client_portal_views.workspace_id
  )
);

-- 4: standup_comments - require workspace membership of parent standup
DROP POLICY IF EXISTS "users insert own standup comments" ON public.standup_comments;

CREATE POLICY "users insert own standup comments"
ON public.standup_comments FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.standups s
    WHERE s.id = standup_comments.standup_id
      AND s.workspace_id IN (SELECT public.get_my_workspace_ids())
  )
);
