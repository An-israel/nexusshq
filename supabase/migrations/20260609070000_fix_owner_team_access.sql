-- Fix workspace owner team management access
--
-- 1. Define can_manage_private_profile() — used by the profiles UPDATE policy
--    in migration 20260526121234 but never implemented, causing all admin/manager
--    profile updates to fail silently.
--
-- 2. Ensure setEmployeeActive can be called by server-side code; the function
--    itself runs with SECURITY DEFINER so the caller's role is not checked at
--    the DB level (the application layer validates permissions).

CREATE OR REPLACE FUNCTION public.can_manage_private_profile(target_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- Returns true if the calling user is an owner/admin/manager in any workspace
  -- that the target user also belongs to.
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

-- Also recreate the profiles UPDATE policy explicitly to pick up the now-defined function
DROP POLICY IF EXISTS "ws admins update shared profiles" ON public.profiles;
CREATE POLICY "ws admins update shared profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (
  id = auth.uid()  -- can always update own profile
  OR public.can_manage_private_profile(id)
)
WITH CHECK (
  id = auth.uid()
  OR public.can_manage_private_profile(id)
);
