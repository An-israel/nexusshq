
-- 1) Tighten profiles SELECT: restrict to self, super-admins, legacy global admins/managers,
-- or co-members of at least one shared workspace.
DROP POLICY IF EXISTS "auth users view active profiles" ON public.profiles;
DROP POLICY IF EXISTS "managers/admins view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "users view own profile" ON public.profiles;

CREATE POLICY "profiles select scoped"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.workspace_members me
    JOIN public.workspace_members them
      ON them.workspace_id = me.workspace_id
    WHERE me.user_id = auth.uid()
      AND me.is_active = true
      AND them.user_id = profiles.id
      AND them.is_active = true
  )
);

-- 2) Admin helper: remove an employee from a workspace (deactivate membership + clear role
-- if they have no other active workspace memberships).
CREATE OR REPLACE FUNCTION public.remove_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid := auth.uid();
  remaining_count int;
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Caller must be owner/admin of the workspace (or super-admin)
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

  -- Don't allow removing yourself this way
  IF _user_id = caller THEN
    RAISE EXCEPTION 'You cannot remove yourself from the workspace';
  END IF;

  -- Don't allow removing the last owner
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

  -- Remove the membership
  DELETE FROM public.workspace_members
  WHERE workspace_id = _workspace_id AND user_id = _user_id;

  -- If they have no other active workspace memberships, deactivate their global profile too
  SELECT COUNT(*) INTO remaining_count
  FROM public.workspace_members
  WHERE user_id = _user_id AND is_active = true;

  IF remaining_count = 0 THEN
    UPDATE public.profiles SET is_active = false WHERE id = _user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_workspace_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_workspace_member(uuid, uuid) TO authenticated;
