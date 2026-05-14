
-- 1. Super admin users table
CREATE TABLE IF NOT EXISTS public.super_admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid
);

ALTER TABLE public.super_admin_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.super_admin_users WHERE user_id = _user_id);
$$;

DROP POLICY IF EXISTS "super admins read self" ON public.super_admin_users;
CREATE POLICY "super admins read self" ON public.super_admin_users
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "super admins manage" ON public.super_admin_users;
CREATE POLICY "super admins manage" ON public.super_admin_users
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Seed the two known super admins
INSERT INTO public.super_admin_users (user_id)
SELECT id FROM public.profiles
WHERE lower(coalesce(email,'')) IN ('skryveai@gmail.com','aniekaneazy@gmail.com')
ON CONFLICT (user_id) DO NOTHING;

-- 2. Allow users to insert their own profile during signup (trigger usually does it,
-- but signup also tries to upsert for safety)
DROP POLICY IF EXISTS "users insert own profile" ON public.profiles;
CREATE POLICY "users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- 3. CRITICAL multi-tenancy fix: ensure_skryve_seed must NOT auto-add every new
-- user to the Skryve workspace. Only super admins belong to Skryve by default.
CREATE OR REPLACE FUNCTION public.ensure_skryve_seed()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  ws_id uuid;
BEGIN
  SELECT id INTO ws_id FROM public.workspaces WHERE slug = 'skryve' LIMIT 1;
  IF ws_id IS NULL THEN
    INSERT INTO public.workspaces (name, slug, primary_color, plan, plan_seats, is_active)
    VALUES ('Skryve', 'skryve', '#6366f1', 'business', 50, true)
    RETURNING id INTO ws_id;
  END IF;

  -- Only add super-admin profiles to Skryve, NOT every user (multi-tenancy fix)
  INSERT INTO public.workspace_members (workspace_id, user_id, role, is_active)
  SELECT ws_id, p.id, 'owner'::workspace_role, true
  FROM public.profiles p
  WHERE lower(coalesce(p.email,'')) IN ('skryveai@gmail.com','aniekaneazy@gmail.com')
    AND NOT EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = ws_id AND wm.user_id = p.id
    );

  RETURN ws_id;
END;
$$;

-- 4. Allow super admins to view/manage all workspaces & members for the dashboard
DROP POLICY IF EXISTS "super admins view all workspaces" ON public.workspaces;
CREATE POLICY "super admins view all workspaces" ON public.workspaces
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "super admins manage all workspaces" ON public.workspaces;
CREATE POLICY "super admins manage all workspaces" ON public.workspaces
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "super admins view all members" ON public.workspace_members;
CREATE POLICY "super admins view all members" ON public.workspace_members
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
