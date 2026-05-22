-- DIAGNOSTIC QUERIES (run manually in Supabase SQL editor):
--
-- 1. Find any auto-add triggers:
-- SELECT trigger_name, event_manipulation, event_object_table, action_statement
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'public' OR trigger_schema = 'auth'
-- ORDER BY trigger_name;
--
-- 2. See which workspace each user is in:
-- SELECT w.name, p.email, wm.role, wm.created_at
-- FROM workspace_members wm
-- JOIN workspaces w ON w.id = wm.workspace_id
-- JOIN profiles p ON p.id = wm.user_id
-- WHERE wm.is_active = true
-- ORDER BY w.created_at, wm.created_at;
--
-- 3. Remove wrongly-added members from a workspace
--    (keep only the owner, remove everyone else who wasn't invited):
-- DELETE FROM workspace_members
-- WHERE workspace_id = (SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1)
-- AND role != 'owner'
-- AND user_id NOT IN (
--   SELECT user_id FROM workspace_invitations
--   WHERE workspace_id = (SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1)
--   AND accepted_at IS NOT NULL
-- );
-- CONFIRM BEFORE RUNNING — adjust the filter to match your actual data.

-- 1. Drop and recreate ensure_skryve_seed as a safe no-op
DROP FUNCTION IF EXISTS public.ensure_skryve_seed() CASCADE;
CREATE FUNCTION public.ensure_skryve_seed()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN;
END;
$$;

-- 2. Add removed_at / removed_by columns to workspace_members
ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS removed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Helper functions (SECURITY DEFINER breaks RLS self-reference recursion)
CREATE OR REPLACE FUNCTION public.get_my_workspace_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT workspace_id FROM workspace_members
  WHERE user_id = auth.uid() AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.get_my_admin_workspace_ids()
RETURNS SETOF uuid LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT workspace_id FROM workspace_members
  WHERE user_id = auth.uid()
    AND role IN ('owner', 'admin')
    AND is_active = true;
$$;

-- 4. Fix workspace_members SELECT policy
DROP POLICY IF EXISTS "workspace_members_select" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_member_select" ON public.workspace_members;
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
CREATE POLICY "workspace_members_select" ON public.workspace_members
  FOR SELECT USING (
    workspace_id IN (SELECT public.get_my_workspace_ids())
  );

-- 5. Fix workspace_members INSERT policy
DROP POLICY IF EXISTS "workspace_members_insert" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_admin_insert" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can insert workspace members" ON public.workspace_members;
CREATE POLICY "workspace_members_insert" ON public.workspace_members
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT public.get_my_admin_workspace_ids())
  );

-- 6. Fix workspace_members UPDATE policy
DROP POLICY IF EXISTS "workspace_members_update" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_admin_update" ON public.workspace_members;
CREATE POLICY "workspace_members_update" ON public.workspace_members
  FOR UPDATE USING (
    workspace_id IN (SELECT public.get_my_admin_workspace_ids())
  );

-- 7. Fix profiles SELECT policy
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR id IN (
      SELECT wm.user_id FROM public.workspace_members wm
      WHERE wm.workspace_id IN (SELECT public.get_my_workspace_ids())
        AND wm.is_active = true
    )
  );

-- 8. Profiles UPDATE — users update their own profile only
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (id = auth.uid());
