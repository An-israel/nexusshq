-- ============================================================
-- MULTI-TENANCY: Full workspace isolation for Nexus HQ SaaS
-- ============================================================

-- ── 1. CORE WORKSPACE TABLES ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workspaces (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  slug             text UNIQUE NOT NULL,
  domain           text,
  logo_url         text,
  primary_color    text NOT NULL DEFAULT '#3B82F6',
  plan             text NOT NULL DEFAULT 'starter'
                   CHECK (plan IN ('starter','growth','business','enterprise')),
  plan_seats       integer NOT NULL DEFAULT 5,
  is_active        boolean NOT NULL DEFAULT true,
  trial_ends_at    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'employee'
               CHECK (role IN ('owner','admin','manager','employee')),
  is_active    boolean NOT NULL DEFAULT true,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  price_ngn   integer NOT NULL DEFAULT 0,
  price_usd   integer NOT NULL DEFAULT 0,
  max_seats   integer NOT NULL DEFAULT 5,
  features    jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan                  text NOT NULL DEFAULT 'starter',
  status                text NOT NULL DEFAULT 'trialing'
                        CHECK (status IN ('trialing','active','past_due','cancelled')),
  current_period_start  timestamptz NOT NULL DEFAULT now(),
  current_period_end    timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  cancelled_at          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.super_admin_users (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── 2. ADD workspace_id TO ALL DATA TABLES ──────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.performance_reviews
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.standups
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.standup_comments
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.message_groups
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.message_group_members
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.client_projects
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.deliverables
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.deliverable_scores
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.flags
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.leave_types
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.leave_balances
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.objectives
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.key_results
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.wiki_pages
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.wiki_sections
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.recurring_tasks
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- ── 3. DEFAULT WORKSPACE FOR EXISTING DATA ──────────────────
-- Wraps in DO block so the INSERT is idempotent on re-runs

DO $$
DECLARE
  v_workspace_id uuid;
  v_owner_id     uuid;
BEGIN
  -- Use existing workspace if already seeded (idempotent)
  SELECT id INTO v_workspace_id FROM public.workspaces WHERE slug IN ('skryve', 'default') LIMIT 1;

  IF v_workspace_id IS NULL THEN
    INSERT INTO public.workspaces (name, slug, plan, plan_seats, is_active, trial_ends_at)
    VALUES ('Skryve', 'skryve', 'growth', 100, true, NULL)
    RETURNING id INTO v_workspace_id;

    -- Create subscription record for the default workspace
    INSERT INTO public.subscriptions (workspace_id, plan, status, current_period_start, current_period_end)
    VALUES (v_workspace_id, 'growth', 'active', now(), now() + interval '10 years');
  END IF;

  -- Backfill every data table that now has a workspace_id column
  UPDATE public.tasks           SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.attendance      SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.notifications   SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.payslips        SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.performance_reviews SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.standups        SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.standup_comments SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.direct_messages  SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.message_groups   SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.group_messages   SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.message_group_members SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.announcements    SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.client_projects  SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.deliverables     SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.deliverable_scores SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.flags            SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.leave_requests   SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.leave_types      SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.leave_balances   SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.objectives       SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.key_results      SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.wiki_pages       SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.wiki_sections    SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.recurring_tasks  SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;
  UPDATE public.feature_flags    SET workspace_id = v_workspace_id WHERE workspace_id IS NULL;

  -- Add every existing profile user as a member of the default workspace
  INSERT INTO public.workspace_members (workspace_id, user_id, role, is_active)
  SELECT
    v_workspace_id,
    p.id,
    COALESCE(
      (SELECT role FROM public.user_roles WHERE user_id = p.id ORDER BY
        CASE role WHEN 'admin' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END LIMIT 1),
      'employee'
    ),
    p.is_active
  FROM public.profiles p
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  -- Make the first admin the workspace owner
  SELECT p.id INTO v_owner_id
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'admin'
  LIMIT 1;

  IF v_owner_id IS NOT NULL THEN
    UPDATE public.workspace_members
    SET role = 'owner'
    WHERE workspace_id = v_workspace_id AND user_id = v_owner_id;

    -- Also make them a super admin
    INSERT INTO public.super_admin_users (user_id)
    VALUES (v_owner_id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END $$;

-- ── 4. HELPER FUNCTION ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_my_workspace_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT workspace_id
  FROM public.workspace_members
  WHERE user_id = auth.uid() AND is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = auth.uid()
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.workspace_role(p_workspace_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin(p_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = auth.uid()
      AND is_active = true
      AND role IN ('owner','admin')
  );
$$;

-- ── 5. RLS ON NEW TABLES ────────────────────────────────────

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.super_admin_users ENABLE ROW LEVEL SECURITY;

-- workspaces: members can read their own workspaces
CREATE POLICY "workspaces members can read"
  ON public.workspaces FOR SELECT TO authenticated
  USING (public.is_workspace_member(id));

-- workspace_members: members can read membership list
CREATE POLICY "workspace_members readable by members"
  ON public.workspace_members FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "workspace_members admins manage"
  ON public.workspace_members FOR ALL TO authenticated
  USING (public.is_workspace_admin(workspace_id))
  WITH CHECK (public.is_workspace_admin(workspace_id));

-- plans: anyone authenticated can read
CREATE POLICY "plans readable by authenticated"
  ON public.plans FOR SELECT TO authenticated USING (true);

-- subscriptions: workspace members can read
CREATE POLICY "subscriptions readable by members"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id));

-- super_admin_users: only the super admin can read (their own row)
CREATE POLICY "super_admin_users self read"
  ON public.super_admin_users FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── 6. UPDATE RLS ON EXISTING TABLES ───────────────────────
-- Pattern: restrict all operations to workspace_id the user belongs to.
-- We drop old policies by name then recreate with workspace scoping.

-- TASKS
DROP POLICY IF EXISTS "tasks visible to assigned user or manager" ON public.tasks;
DROP POLICY IF EXISTS "managers can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "managers can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "assigned users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "managers can delete tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks select" ON public.tasks;
DROP POLICY IF EXISTS "tasks insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks update" ON public.tasks;
DROP POLICY IF EXISTS "tasks delete" ON public.tasks;

CREATE POLICY "tasks select"  ON public.tasks FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "tasks insert"  ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "tasks update"  ON public.tasks FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "tasks delete"  ON public.tasks FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- ATTENDANCE
DROP POLICY IF EXISTS "attendance select" ON public.attendance;
DROP POLICY IF EXISTS "attendance insert" ON public.attendance;
DROP POLICY IF EXISTS "attendance update" ON public.attendance;
DROP POLICY IF EXISTS "attendance delete" ON public.attendance;
DROP POLICY IF EXISTS "Users can view own attendance or managers all" ON public.attendance;
DROP POLICY IF EXISTS "Users can insert own attendance" ON public.attendance;
DROP POLICY IF EXISTS "Users can update own attendance" ON public.attendance;
DROP POLICY IF EXISTS "attendance readable by user and managers" ON public.attendance;
DROP POLICY IF EXISTS "attendance insertable by authenticated" ON public.attendance;
DROP POLICY IF EXISTS "attendance updatable by user and managers" ON public.attendance;

CREATE POLICY "attendance select" ON public.attendance FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "attendance insert" ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "attendance update" ON public.attendance FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "attendance delete" ON public.attendance FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- NOTIFICATIONS
DROP POLICY IF EXISTS "notifications select" ON public.notifications;
DROP POLICY IF EXISTS "notifications insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications update" ON public.notifications;
DROP POLICY IF EXISTS "notifications delete" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;

CREATE POLICY "notifications select" ON public.notifications FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "notifications insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "notifications update" ON public.notifications FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "notifications delete" ON public.notifications FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- PAYSLIPS
DROP POLICY IF EXISTS "payslips select" ON public.payslips;
DROP POLICY IF EXISTS "payslips insert" ON public.payslips;
DROP POLICY IF EXISTS "payslips update" ON public.payslips;
DROP POLICY IF EXISTS "payslips delete" ON public.payslips;
DROP POLICY IF EXISTS "payslips readable by owner or manager" ON public.payslips;
DROP POLICY IF EXISTS "payslips insertable by managers" ON public.payslips;
DROP POLICY IF EXISTS "payslips updatable by managers" ON public.payslips;

CREATE POLICY "payslips select" ON public.payslips FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "payslips insert" ON public.payslips FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "payslips update" ON public.payslips FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "payslips delete" ON public.payslips FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- PERFORMANCE REVIEWS
DROP POLICY IF EXISTS "performance_reviews select" ON public.performance_reviews;
DROP POLICY IF EXISTS "performance_reviews insert" ON public.performance_reviews;
DROP POLICY IF EXISTS "performance_reviews update" ON public.performance_reviews;
DROP POLICY IF EXISTS "performance_reviews delete" ON public.performance_reviews;
DROP POLICY IF EXISTS "performance reviews readable by subject or manager" ON public.performance_reviews;
DROP POLICY IF EXISTS "managers can insert performance reviews" ON public.performance_reviews;
DROP POLICY IF EXISTS "managers can update performance reviews" ON public.performance_reviews;

CREATE POLICY "performance_reviews select" ON public.performance_reviews FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "performance_reviews insert" ON public.performance_reviews FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "performance_reviews update" ON public.performance_reviews FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "performance_reviews delete" ON public.performance_reviews FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- STANDUPS
DROP POLICY IF EXISTS "standups select" ON public.standups;
DROP POLICY IF EXISTS "standups insert" ON public.standups;
DROP POLICY IF EXISTS "standups update" ON public.standups;
DROP POLICY IF EXISTS "standups delete" ON public.standups;
DROP POLICY IF EXISTS "standups readable by workspace" ON public.standups;
DROP POLICY IF EXISTS "standups insertable by authenticated" ON public.standups;
DROP POLICY IF EXISTS "standups updatable by owner or manager" ON public.standups;

CREATE POLICY "standups select" ON public.standups FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "standups insert" ON public.standups FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "standups update" ON public.standups FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "standups delete" ON public.standups FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- STANDUP COMMENTS
DROP POLICY IF EXISTS "standup_comments select" ON public.standup_comments;
DROP POLICY IF EXISTS "standup_comments insert" ON public.standup_comments;
DROP POLICY IF EXISTS "standup_comments delete" ON public.standup_comments;

CREATE POLICY "standup_comments select" ON public.standup_comments FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "standup_comments insert" ON public.standup_comments FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "standup_comments delete" ON public.standup_comments FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- DIRECT MESSAGES
DROP POLICY IF EXISTS "direct_messages select" ON public.direct_messages;
DROP POLICY IF EXISTS "direct_messages insert" ON public.direct_messages;
DROP POLICY IF EXISTS "direct_messages update" ON public.direct_messages;
DROP POLICY IF EXISTS "direct_messages delete" ON public.direct_messages;
DROP POLICY IF EXISTS "DMs readable by participants" ON public.direct_messages;
DROP POLICY IF EXISTS "authenticated users can send DMs" ON public.direct_messages;
DROP POLICY IF EXISTS "sender can update own DMs" ON public.direct_messages;
DROP POLICY IF EXISTS "sender can delete own DMs" ON public.direct_messages;

CREATE POLICY "direct_messages select" ON public.direct_messages FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "direct_messages insert" ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "direct_messages update" ON public.direct_messages FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "direct_messages delete" ON public.direct_messages FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- MESSAGE GROUPS
DROP POLICY IF EXISTS "message_groups select" ON public.message_groups;
DROP POLICY IF EXISTS "message_groups insert" ON public.message_groups;
DROP POLICY IF EXISTS "message_groups update" ON public.message_groups;
DROP POLICY IF EXISTS "message_groups delete" ON public.message_groups;
DROP POLICY IF EXISTS "group messages visible to members" ON public.message_groups;
DROP POLICY IF EXISTS "authenticated users can create groups" ON public.message_groups;
DROP POLICY IF EXISTS "group creator or admin can update" ON public.message_groups;
DROP POLICY IF EXISTS "group creator or admin can delete" ON public.message_groups;

CREATE POLICY "message_groups select" ON public.message_groups FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "message_groups insert" ON public.message_groups FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "message_groups update" ON public.message_groups FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "message_groups delete" ON public.message_groups FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- GROUP MESSAGES
DROP POLICY IF EXISTS "group_messages select" ON public.group_messages;
DROP POLICY IF EXISTS "group_messages insert" ON public.group_messages;
DROP POLICY IF EXISTS "group_messages update" ON public.group_messages;
DROP POLICY IF EXISTS "group_messages delete" ON public.group_messages;
DROP POLICY IF EXISTS "group messages visible to members" ON public.group_messages;
DROP POLICY IF EXISTS "group members can send messages" ON public.group_messages;
DROP POLICY IF EXISTS "sender can update own group messages" ON public.group_messages;
DROP POLICY IF EXISTS "sender can delete own group messages" ON public.group_messages;

CREATE POLICY "group_messages select" ON public.group_messages FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "group_messages insert" ON public.group_messages FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "group_messages update" ON public.group_messages FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "group_messages delete" ON public.group_messages FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- MESSAGE GROUP MEMBERS
DROP POLICY IF EXISTS "message_group_members select" ON public.message_group_members;
DROP POLICY IF EXISTS "message_group_members insert" ON public.message_group_members;
DROP POLICY IF EXISTS "message_group_members delete" ON public.message_group_members;
DROP POLICY IF EXISTS "group members visible to group members" ON public.message_group_members;
DROP POLICY IF EXISTS "group admins can manage members" ON public.message_group_members;

CREATE POLICY "message_group_members select" ON public.message_group_members FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "message_group_members insert" ON public.message_group_members FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "message_group_members delete" ON public.message_group_members FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- ANNOUNCEMENTS
DROP POLICY IF EXISTS "announcements select" ON public.announcements;
DROP POLICY IF EXISTS "announcements insert" ON public.announcements;
DROP POLICY IF EXISTS "announcements update" ON public.announcements;
DROP POLICY IF EXISTS "announcements delete" ON public.announcements;
DROP POLICY IF EXISTS "announcements readable by authenticated" ON public.announcements;
DROP POLICY IF EXISTS "announcements insertable by managers" ON public.announcements;
DROP POLICY IF EXISTS "announcements updatable by managers" ON public.announcements;
DROP POLICY IF EXISTS "announcements deletable by managers" ON public.announcements;

CREATE POLICY "announcements select" ON public.announcements FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "announcements insert" ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "announcements update" ON public.announcements FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "announcements delete" ON public.announcements FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- CLIENT PROJECTS
DROP POLICY IF EXISTS "client_projects select" ON public.client_projects;
DROP POLICY IF EXISTS "client_projects insert" ON public.client_projects;
DROP POLICY IF EXISTS "client_projects update" ON public.client_projects;
DROP POLICY IF EXISTS "client_projects delete" ON public.client_projects;
DROP POLICY IF EXISTS "client projects visible to team members" ON public.client_projects;
DROP POLICY IF EXISTS "managers can insert client projects" ON public.client_projects;
DROP POLICY IF EXISTS "managers can update client projects" ON public.client_projects;
DROP POLICY IF EXISTS "managers can delete client projects" ON public.client_projects;

CREATE POLICY "client_projects select" ON public.client_projects FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "client_projects insert" ON public.client_projects FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "client_projects update" ON public.client_projects FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "client_projects delete" ON public.client_projects FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- DELIVERABLES
DROP POLICY IF EXISTS "deliverables select" ON public.deliverables;
DROP POLICY IF EXISTS "deliverables insert" ON public.deliverables;
DROP POLICY IF EXISTS "deliverables update" ON public.deliverables;
DROP POLICY IF EXISTS "deliverables delete" ON public.deliverables;
DROP POLICY IF EXISTS "deliverables readable by authenticated" ON public.deliverables;
DROP POLICY IF EXISTS "deliverables insertable by managers" ON public.deliverables;
DROP POLICY IF EXISTS "deliverables updatable by managers" ON public.deliverables;
DROP POLICY IF EXISTS "deliverables deletable by managers" ON public.deliverables;

CREATE POLICY "deliverables select" ON public.deliverables FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "deliverables insert" ON public.deliverables FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "deliverables update" ON public.deliverables FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "deliverables delete" ON public.deliverables FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- DELIVERABLE SCORES
DROP POLICY IF EXISTS "deliverable_scores select" ON public.deliverable_scores;
DROP POLICY IF EXISTS "deliverable_scores insert" ON public.deliverable_scores;
DROP POLICY IF EXISTS "deliverable_scores update" ON public.deliverable_scores;
DROP POLICY IF EXISTS "deliverable_scores delete" ON public.deliverable_scores;

CREATE POLICY "deliverable_scores select" ON public.deliverable_scores FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "deliverable_scores insert" ON public.deliverable_scores FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "deliverable_scores update" ON public.deliverable_scores FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "deliverable_scores delete" ON public.deliverable_scores FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- FLAGS
DROP POLICY IF EXISTS "flags select" ON public.flags;
DROP POLICY IF EXISTS "flags insert" ON public.flags;
DROP POLICY IF EXISTS "flags update" ON public.flags;
DROP POLICY IF EXISTS "flags delete" ON public.flags;
DROP POLICY IF EXISTS "flags readable by managers" ON public.flags;
DROP POLICY IF EXISTS "flags insertable by authenticated" ON public.flags;
DROP POLICY IF EXISTS "flags updatable by managers" ON public.flags;

CREATE POLICY "flags select" ON public.flags FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "flags insert" ON public.flags FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "flags update" ON public.flags FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "flags delete" ON public.flags FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- LEAVE REQUESTS
DROP POLICY IF EXISTS "leave_requests select" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests insert" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests update" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests delete" ON public.leave_requests;
DROP POLICY IF EXISTS "leave requests visible to requester and managers" ON public.leave_requests;
DROP POLICY IF EXISTS "authenticated users can submit leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "managers can update leave requests" ON public.leave_requests;

CREATE POLICY "leave_requests select" ON public.leave_requests FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "leave_requests insert" ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "leave_requests update" ON public.leave_requests FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "leave_requests delete" ON public.leave_requests FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- LEAVE TYPES
DROP POLICY IF EXISTS "leave_types select" ON public.leave_types;
DROP POLICY IF EXISTS "leave_types insert" ON public.leave_types;
DROP POLICY IF EXISTS "leave_types update" ON public.leave_types;
DROP POLICY IF EXISTS "leave_types delete" ON public.leave_types;
DROP POLICY IF EXISTS "leave types readable by authenticated" ON public.leave_types;
DROP POLICY IF EXISTS "leave types manageable by managers" ON public.leave_types;

CREATE POLICY "leave_types select" ON public.leave_types FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "leave_types insert" ON public.leave_types FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "leave_types update" ON public.leave_types FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "leave_types delete" ON public.leave_types FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- LEAVE BALANCES
DROP POLICY IF EXISTS "leave_balances select" ON public.leave_balances;
DROP POLICY IF EXISTS "leave_balances insert" ON public.leave_balances;
DROP POLICY IF EXISTS "leave_balances update" ON public.leave_balances;
DROP POLICY IF EXISTS "leave_balances delete" ON public.leave_balances;
DROP POLICY IF EXISTS "leave balances visible to owner and managers" ON public.leave_balances;
DROP POLICY IF EXISTS "managers can manage leave balances" ON public.leave_balances;

CREATE POLICY "leave_balances select" ON public.leave_balances FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "leave_balances insert" ON public.leave_balances FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "leave_balances update" ON public.leave_balances FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "leave_balances delete" ON public.leave_balances FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- OBJECTIVES
DROP POLICY IF EXISTS "objectives select" ON public.objectives;
DROP POLICY IF EXISTS "objectives insert" ON public.objectives;
DROP POLICY IF EXISTS "objectives update" ON public.objectives;
DROP POLICY IF EXISTS "objectives delete" ON public.objectives;
DROP POLICY IF EXISTS "objectives readable by authenticated" ON public.objectives;
DROP POLICY IF EXISTS "objectives insertable by managers" ON public.objectives;
DROP POLICY IF EXISTS "objectives updatable by managers" ON public.objectives;
DROP POLICY IF EXISTS "objectives deletable by managers" ON public.objectives;

CREATE POLICY "objectives select" ON public.objectives FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "objectives insert" ON public.objectives FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "objectives update" ON public.objectives FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "objectives delete" ON public.objectives FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- KEY RESULTS
DROP POLICY IF EXISTS "key_results select" ON public.key_results;
DROP POLICY IF EXISTS "key_results insert" ON public.key_results;
DROP POLICY IF EXISTS "key_results update" ON public.key_results;
DROP POLICY IF EXISTS "key_results delete" ON public.key_results;
DROP POLICY IF EXISTS "key results readable by authenticated" ON public.key_results;
DROP POLICY IF EXISTS "key results insertable by managers" ON public.key_results;
DROP POLICY IF EXISTS "key results updatable by managers" ON public.key_results;
DROP POLICY IF EXISTS "key results deletable by managers" ON public.key_results;

CREATE POLICY "key_results select" ON public.key_results FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "key_results insert" ON public.key_results FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "key_results update" ON public.key_results FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "key_results delete" ON public.key_results FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- WIKI PAGES
DROP POLICY IF EXISTS "wiki_pages select" ON public.wiki_pages;
DROP POLICY IF EXISTS "wiki_pages insert" ON public.wiki_pages;
DROP POLICY IF EXISTS "wiki_pages update" ON public.wiki_pages;
DROP POLICY IF EXISTS "wiki_pages delete" ON public.wiki_pages;
DROP POLICY IF EXISTS "wiki pages readable by authenticated" ON public.wiki_pages;
DROP POLICY IF EXISTS "wiki pages insertable by managers" ON public.wiki_pages;
DROP POLICY IF EXISTS "wiki pages updatable by managers" ON public.wiki_pages;
DROP POLICY IF EXISTS "wiki pages deletable by managers" ON public.wiki_pages;

CREATE POLICY "wiki_pages select" ON public.wiki_pages FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "wiki_pages insert" ON public.wiki_pages FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "wiki_pages update" ON public.wiki_pages FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "wiki_pages delete" ON public.wiki_pages FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- WIKI SECTIONS
DROP POLICY IF EXISTS "wiki_sections select" ON public.wiki_sections;
DROP POLICY IF EXISTS "wiki_sections insert" ON public.wiki_sections;
DROP POLICY IF EXISTS "wiki_sections update" ON public.wiki_sections;
DROP POLICY IF EXISTS "wiki_sections delete" ON public.wiki_sections;

CREATE POLICY "wiki_sections select" ON public.wiki_sections FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "wiki_sections insert" ON public.wiki_sections FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "wiki_sections update" ON public.wiki_sections FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "wiki_sections delete" ON public.wiki_sections FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- RECURRING TASKS
DROP POLICY IF EXISTS "recurring_tasks select" ON public.recurring_tasks;
DROP POLICY IF EXISTS "recurring_tasks insert" ON public.recurring_tasks;
DROP POLICY IF EXISTS "recurring_tasks update" ON public.recurring_tasks;
DROP POLICY IF EXISTS "recurring_tasks delete" ON public.recurring_tasks;
DROP POLICY IF EXISTS "recurring tasks visible to team" ON public.recurring_tasks;
DROP POLICY IF EXISTS "managers can manage recurring tasks" ON public.recurring_tasks;

CREATE POLICY "recurring_tasks select" ON public.recurring_tasks FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "recurring_tasks insert" ON public.recurring_tasks FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "recurring_tasks update" ON public.recurring_tasks FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "recurring_tasks delete" ON public.recurring_tasks FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- FEATURE FLAGS
DROP POLICY IF EXISTS "feature_flags readable by authenticated" ON public.feature_flags;
DROP POLICY IF EXISTS "feature_flags admins insert" ON public.feature_flags;
DROP POLICY IF EXISTS "feature_flags admins update" ON public.feature_flags;
DROP POLICY IF EXISTS "feature_flags admins delete" ON public.feature_flags;

CREATE POLICY "feature_flags select" ON public.feature_flags FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "feature_flags insert" ON public.feature_flags FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "feature_flags update" ON public.feature_flags FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));
CREATE POLICY "feature_flags delete" ON public.feature_flags FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- ── 7. REALTIME ──────────────────────────────────────────────

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'workspaces','workspace_members','subscriptions'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ── 8. INDEXES FOR PERFORMANCE ───────────────────────────────

CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id     ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug               ON public.workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace_id            ON public.tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_attendance_workspace_id       ON public.attendance(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace_id    ON public.notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_workspace_id  ON public.direct_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_workspace_id   ON public.group_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_announcements_workspace_id    ON public.announcements(workspace_id);

-- ── 9. FEATURE_FLAGS: drop single-key PK, add composite unique ──────────────
-- The key was previously the sole primary key; with workspace scoping
-- the unique constraint must be (key, workspace_id).

ALTER TABLE public.feature_flags DROP CONSTRAINT IF EXISTS feature_flags_pkey;
ALTER TABLE public.feature_flags ADD COLUMN IF NOT EXISTS id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.feature_flags ADD PRIMARY KEY (id);
ALTER TABLE public.feature_flags ADD CONSTRAINT feature_flags_key_workspace_unique UNIQUE (key, workspace_id);
