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
-- 3. Remove wrongly-added members from SkryveAI workspace
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

-- 1. Neutralize ensure_skryve_seed — make it a safe no-op
-- (DROP would break if something still calls it; replace with no-op instead)
CREATE OR REPLACE FUNCTION public.ensure_skryve_seed()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- No-op: legacy function replaced by seed_workspace_defaults()
  -- which is called per-workspace at creation time.
  RETURN;
END;
$$;

-- 2. Add removed_at / removed_by columns to workspace_members
ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS removed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. Fix workspace_members SELECT policy
-- Members should only see other members of workspaces they belong to
DROP POLICY IF EXISTS "workspace_members_select" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_member_select" ON public.workspace_members;
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
CREATE POLICY "workspace_members_select" ON public.workspace_members
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- 4. Fix workspace_members INSERT policy
-- Only owners/admins of a workspace can add members
DROP POLICY IF EXISTS "workspace_members_insert" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_admin_insert" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can insert workspace members" ON public.workspace_members;
CREATE POLICY "workspace_members_insert" ON public.workspace_members
  FOR INSERT WITH CHECK (
    -- Service role bypass (for RPCs with SECURITY DEFINER) handles workspace creation.
    -- For client inserts: requester must be owner/admin of that workspace.
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- 5. Fix workspace_members UPDATE policy
DROP POLICY IF EXISTS "workspace_members_update" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_admin_update" ON public.workspace_members;
CREATE POLICY "workspace_members_update" ON public.workspace_members
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
        AND is_active = true
    )
  );

-- 6. Fix profiles SELECT policy
-- A user should only see profiles of people in their workspaces
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR id IN (
      SELECT wm2.user_id
      FROM public.workspace_members wm2
      WHERE wm2.workspace_id IN (
        SELECT wm1.workspace_id
        FROM public.workspace_members wm1
        WHERE wm1.user_id = auth.uid()
          AND wm1.is_active = true
      )
      AND wm2.is_active = true
    )
  );

-- 7. Profiles UPDATE — users update their own profile only
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (id = auth.uid());
