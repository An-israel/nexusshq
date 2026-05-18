CREATE OR REPLACE FUNCTION public.is_dm_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dm_members dm
    JOIN public.dm_conversations dc ON dc.id = dm.conversation_id
    JOIN public.workspace_members wm
      ON wm.workspace_id = dc.workspace_id
     AND wm.user_id = _user_id
     AND wm.is_active = true
    WHERE dm.conversation_id = _conversation_id
      AND dm.user_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "dm_conversations select" ON public.dm_conversations;
CREATE POLICY "dm_conversations select"
ON public.dm_conversations
FOR SELECT
TO authenticated
USING (
  workspace_id IN (SELECT public.get_my_workspace_ids())
  AND public.is_dm_conversation_member(id, auth.uid())
);

DROP POLICY IF EXISTS "dm_conversations update" ON public.dm_conversations;
CREATE POLICY "dm_conversations update"
ON public.dm_conversations
FOR UPDATE
TO authenticated
USING (
  workspace_id IN (SELECT public.get_my_workspace_ids())
  AND public.is_dm_conversation_member(id, auth.uid())
);

DROP POLICY IF EXISTS "dm_members select" ON public.dm_members;
CREATE POLICY "dm_members select"
ON public.dm_members
FOR SELECT
TO authenticated
USING (
  public.is_dm_conversation_member(conversation_id, auth.uid())
);

DROP POLICY IF EXISTS "dm_members update" ON public.dm_members;
CREATE POLICY "dm_members update"
ON public.dm_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());