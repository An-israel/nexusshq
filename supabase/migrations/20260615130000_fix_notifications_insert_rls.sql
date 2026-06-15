-- The "create notifications scoped" policy (20260526121234, re-applied by
-- 20260611140000) only allows a user to create a notification for someone
-- else if they are a manager/admin/owner (shares_workspace_with requires
-- role IN ('owner','admin','manager')).
--
-- That silently breaks the client-side notifyMentions()/notifyPinChange()
-- inserts (src/lib/messaging/notify.ts) for regular employees: when an
-- employee @mentions or pins/unpins a message, the INSERT into
-- notifications for the mentioned/affected users is rejected by RLS and
-- swallowed by the best-effort try/catch, so those users never get an
-- in-app notification.
--
-- Restore the ability for any workspace member to notify another active
-- member of a workspace they both belong to (this is what the original
-- 20260507000000 policy allowed, before it was narrowed to managers-only).
DROP POLICY IF EXISTS "create notifications scoped" ON public.notifications;
CREATE POLICY "create notifications scoped"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR (
    workspace_id IN (SELECT public.get_my_workspace_ids())
    AND EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.user_id = notifications.user_id
        AND wm.workspace_id = notifications.workspace_id
        AND wm.is_active = true
    )
  )
);
