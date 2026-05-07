
-- Workspace plan enum
DO $$ BEGIN
  CREATE TYPE workspace_plan AS ENUM ('starter','growth','business','enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE workspace_member_role AS ENUM ('owner','admin','manager','employee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  primary_color text NOT NULL DEFAULT '#6366f1',
  plan workspace_plan NOT NULL DEFAULT 'business',
  plan_seats integer,
  is_active boolean NOT NULL DEFAULT true,
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role workspace_member_role NOT NULL DEFAULT 'employee',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan workspace_plan NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Helper: is user a member of workspace?
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id AND user_id = _user_id AND is_active = true
      AND role IN ('owner','admin')
  );
$$;

-- Workspaces policies
DROP POLICY IF EXISTS "members view workspace" ON public.workspaces;
CREATE POLICY "members view workspace" ON public.workspaces FOR SELECT TO authenticated
USING (public.is_workspace_member(id, auth.uid()));

DROP POLICY IF EXISTS "admins update workspace" ON public.workspaces;
CREATE POLICY "admins update workspace" ON public.workspaces FOR UPDATE TO authenticated
USING (public.is_workspace_admin(id, auth.uid()));

DROP POLICY IF EXISTS "authenticated create workspace" ON public.workspaces;
CREATE POLICY "authenticated create workspace" ON public.workspaces FOR INSERT TO authenticated
WITH CHECK (true);

-- workspace_members policies
DROP POLICY IF EXISTS "members view memberships" ON public.workspace_members;
CREATE POLICY "members view memberships" ON public.workspace_members FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "admins manage memberships" ON public.workspace_members;
CREATE POLICY "admins manage memberships" ON public.workspace_members FOR ALL TO authenticated
USING (public.is_workspace_admin(workspace_id, auth.uid()))
WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "self insert membership" ON public.workspace_members;
CREATE POLICY "self insert membership" ON public.workspace_members FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- subscriptions policies
DROP POLICY IF EXISTS "members view subscription" ON public.subscriptions;
CREATE POLICY "members view subscription" ON public.subscriptions FOR SELECT TO authenticated
USING (public.is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "admins manage subscription" ON public.subscriptions;
CREATE POLICY "admins manage subscription" ON public.subscriptions FOR ALL TO authenticated
USING (public.is_workspace_admin(workspace_id, auth.uid()))
WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "authenticated create subscription" ON public.subscriptions;
CREATE POLICY "authenticated create subscription" ON public.subscriptions FOR INSERT TO authenticated
WITH CHECK (true);

-- Seed Skryve workspace
INSERT INTO public.workspaces (name, slug, plan, plan_seats, is_active)
VALUES ('Skryve', 'skryve', 'business', NULL, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.subscriptions (workspace_id, plan, status, current_period_start, current_period_end)
SELECT id, 'business', 'active', now(), now() + interval '100 years'
FROM public.workspaces WHERE slug = 'skryve'
ON CONFLICT DO NOTHING;

-- Add all existing profile users as members. Map legacy user_roles → workspace_members.role.
INSERT INTO public.workspace_members (workspace_id, user_id, role, is_active)
SELECT
  w.id,
  p.id,
  CASE
    WHEN p.email IN ('skryveai@gmail.com','aniekaneazy@gmail.com') THEN 'owner'::workspace_member_role
    WHEN ur.role = 'admin'   THEN 'admin'::workspace_member_role
    WHEN ur.role = 'manager' THEN 'manager'::workspace_member_role
    ELSE 'employee'::workspace_member_role
  END,
  true
FROM public.profiles p
CROSS JOIN public.workspaces w
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
WHERE w.slug = 'skryve'
ON CONFLICT (workspace_id, user_id) DO NOTHING;
