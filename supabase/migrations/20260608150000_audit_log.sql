-- Global audit log: records who did what, when, scoped per workspace.
-- Two write paths:
--   1. log_audit_event() — a SECURITY DEFINER RPC any active workspace member
--      can call (validated against their own membership) for app-level events
--      raised from client/server code (role changes, announcements, etc).
--   2. Sensitive admin RPCs (e.g. remove_workspace_member) write directly so
--      the entry can never be skipped regardless of which UI path is used.
-- Only workspace owners/admins (or super-admins) can read a workspace's log.

CREATE TABLE public.audit_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action       text NOT NULL,
  target_type  text,
  target_id    uuid,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX audit_events_workspace_created_idx
  ON public.audit_events (workspace_id, created_at DESC);

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- No INSERT/UPDATE/DELETE policies are defined on purpose: all writes go
-- through SECURITY DEFINER functions so entries can't be forged or edited.
CREATE POLICY "audit_events_select_admins" ON public.audit_events
  FOR SELECT USING (
    public.is_super_admin(auth.uid())
    OR workspace_id IN (SELECT public.get_my_admin_workspace_ids())
  );

CREATE OR REPLACE FUNCTION public.log_audit_event(
  _workspace_id uuid,
  _action text,
  _target_type text DEFAULT NULL,
  _target_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  new_id uuid;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = caller AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Forbidden: not a member of this workspace';
  END IF;

  INSERT INTO public.audit_events (workspace_id, actor_id, action, target_type, target_id, metadata)
  VALUES (_workspace_id, caller, _action, _target_type, _target_id, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit_event(uuid, text, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_audit_event(uuid, text, text, uuid, jsonb) TO authenticated;

-- Re-create remove_workspace_member so the removal is always recorded,
-- regardless of which UI path triggered it (this is the most sensitive admin
-- action in the product, so it must not depend on the client remembering to log it).
CREATE OR REPLACE FUNCTION public.remove_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  remaining_count int;
  target_name text;
  target_email text;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.is_super_admin(caller)
    OR EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = _workspace_id
        AND user_id = caller
        AND is_active = true
        AND role IN ('owner','admin')
    )
  ) THEN
    RAISE EXCEPTION 'Forbidden: only workspace owners/admins can remove members';
  END IF;

  IF _user_id = caller THEN
    RAISE EXCEPTION 'You cannot remove yourself from the workspace';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id
      AND role = 'owner' AND is_active = true
  ) AND (
    SELECT COUNT(*) FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND role = 'owner' AND is_active = true
  ) <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last owner of the workspace';
  END IF;

  SELECT full_name, email INTO target_name, target_email
  FROM public.profiles WHERE id = _user_id;

  DELETE FROM public.workspace_members
  WHERE workspace_id = _workspace_id AND user_id = _user_id;

  SELECT COUNT(*) INTO remaining_count
  FROM public.workspace_members
  WHERE user_id = _user_id AND is_active = true;

  IF remaining_count = 0 THEN
    UPDATE public.profiles SET is_active = false WHERE id = _user_id;
  END IF;

  INSERT INTO public.audit_events (workspace_id, actor_id, action, target_type, target_id, metadata)
  VALUES (
    _workspace_id,
    caller,
    'member.removed',
    'workspace_member',
    _user_id,
    jsonb_build_object('target_name', target_name, 'target_email', target_email)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.remove_workspace_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_workspace_member(uuid, uuid) TO authenticated;
