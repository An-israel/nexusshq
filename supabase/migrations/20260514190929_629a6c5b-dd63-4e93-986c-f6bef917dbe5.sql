
-- Fix broken self-join in channels SELECT policy
DROP POLICY IF EXISTS "channels select" ON public.channels;
CREATE POLICY "channels select" ON public.channels FOR SELECT TO authenticated
USING (
  workspace_id IN (SELECT public.get_my_workspace_ids())
  AND (
    type IN ('public', 'announcement')
    OR EXISTS (
      SELECT 1 FROM public.channel_members cm
      WHERE cm.channel_id = channels.id AND cm.user_id = auth.uid()
    )
  )
);

-- Fix broken self-join in dm_conversations SELECT policy
DROP POLICY IF EXISTS "dm_conversations select" ON public.dm_conversations;
CREATE POLICY "dm_conversations select" ON public.dm_conversations FOR SELECT TO authenticated
USING (
  workspace_id IN (SELECT public.get_my_workspace_ids())
  AND EXISTS (
    SELECT 1 FROM public.dm_members dm
    WHERE dm.conversation_id = dm_conversations.id AND dm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "dm_conversations update" ON public.dm_conversations;
CREATE POLICY "dm_conversations update" ON public.dm_conversations FOR UPDATE TO authenticated
USING (
  workspace_id IN (SELECT public.get_my_workspace_ids())
  AND EXISTS (
    SELECT 1 FROM public.dm_members dm
    WHERE dm.conversation_id = dm_conversations.id AND dm.user_id = auth.uid()
  )
);

-- Fix broken self-join in dm_members SELECT policy
DROP POLICY IF EXISTS "dm_members select" ON public.dm_members;
CREATE POLICY "dm_members select" ON public.dm_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.dm_conversations dc
    WHERE dc.id = dm_members.conversation_id
      AND dc.workspace_id IN (SELECT public.get_my_workspace_ids())
  )
  AND EXISTS (
    SELECT 1 FROM public.dm_members dm2
    WHERE dm2.conversation_id = dm_members.conversation_id
      AND dm2.user_id = auth.uid()
  )
);

-- Scope direct_messages SELECT/INSERT to current workspace memberships
DROP POLICY IF EXISTS "users view own messages" ON public.direct_messages;
CREATE POLICY "users view own messages" ON public.direct_messages FOR SELECT
USING (
  (from_id = auth.uid() OR to_id = auth.uid())
  AND (workspace_id IS NULL OR workspace_id IN (SELECT public.get_my_workspace_ids()))
);

DROP POLICY IF EXISTS "users send messages" ON public.direct_messages;
CREATE POLICY "users send messages" ON public.direct_messages FOR INSERT
WITH CHECK (
  from_id = auth.uid()
  AND (workspace_id IS NULL OR workspace_id IN (SELECT public.get_my_workspace_ids()))
);

-- Scope group_messages by workspace as well
DROP POLICY IF EXISTS "members view group messages" ON public.group_messages;
CREATE POLICY "members view group messages" ON public.group_messages FOR SELECT
USING (
  public.is_group_member(group_id, auth.uid())
  AND (workspace_id IS NULL OR workspace_id IN (SELECT public.get_my_workspace_ids()))
);

DROP POLICY IF EXISTS "members send group messages" ON public.group_messages;
CREATE POLICY "members send group messages" ON public.group_messages FOR INSERT
WITH CHECK (
  from_id = auth.uid()
  AND public.is_group_member(group_id, auth.uid())
  AND (workspace_id IS NULL OR workspace_id IN (SELECT public.get_my_workspace_ids()))
);
