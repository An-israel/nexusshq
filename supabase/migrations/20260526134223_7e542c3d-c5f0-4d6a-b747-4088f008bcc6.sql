
-- 1. Drop overly-permissive group avatars UPDATE storage policy
DROP POLICY IF EXISTS "auth update group avatars" ON storage.objects;

-- 2. Tighten documents bucket INSERT policy: require path's first folder = workspace_id the caller manages
DROP POLICY IF EXISTS "documents managers upload" ON storage.objects;
CREATE POLICY "documents managers upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1]::uuid IN (
    SELECT workspace_id FROM public.workspace_members
    WHERE user_id = auth.uid()
      AND is_active = true
      AND role IN ('owner','admin','manager')
  )
);

-- 3. Tighten key_result_updates INSERT: caller must belong to the key_result's workspace
DROP POLICY IF EXISTS "any user inserts kr update" ON public.key_result_updates;
CREATE POLICY "members insert kr update in own workspace" ON public.key_result_updates
FOR INSERT TO authenticated
WITH CHECK (
  updated_by = auth.uid()
  AND key_result_id IN (
    SELECT id FROM public.key_results
    WHERE workspace_id IN (SELECT public.get_my_workspace_ids())
  )
);

-- 4. Restrict realtime.messages to topics that name the caller's workspace or own uid
DROP POLICY IF EXISTS "active members can receive realtime" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated receive realtime" ON realtime.messages;
CREATE POLICY "tenant scoped realtime" ON realtime.messages
FOR SELECT TO authenticated
USING (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
  OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.user_id = auth.uid()
      AND wm.is_active = true
      AND realtime.topic() LIKE '%' || wm.workspace_id::text || '%'
  )
);

-- 5. Remove blanket self-insert into workspace_members; joins must go through the invitation flow (service role)
DROP POLICY IF EXISTS "self insert membership" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert" ON public.workspace_members;
