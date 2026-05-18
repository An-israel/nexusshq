CREATE OR REPLACE FUNCTION public.can_manage_dm_members(
  _conversation_id uuid,
  _target_user_id uuid,
  _actor_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.dm_conversations dc
    JOIN public.workspace_members actor_wm
      ON actor_wm.workspace_id = dc.workspace_id
     AND actor_wm.user_id = _actor_user_id
     AND actor_wm.is_active = true
    JOIN public.workspace_members target_wm
      ON target_wm.workspace_id = dc.workspace_id
     AND target_wm.user_id = _target_user_id
     AND target_wm.is_active = true
    WHERE dc.id = _conversation_id
      AND (
        dc.created_by = _actor_user_id
        OR EXISTS (
          SELECT 1
          FROM public.dm_members dm
          WHERE dm.conversation_id = _conversation_id
            AND dm.user_id = _actor_user_id
        )
      )
  );
$$;

DROP POLICY IF EXISTS "dm_members insert" ON public.dm_members;
CREATE POLICY "dm_members insert"
ON public.dm_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.can_manage_dm_members(conversation_id, user_id, auth.uid())
);