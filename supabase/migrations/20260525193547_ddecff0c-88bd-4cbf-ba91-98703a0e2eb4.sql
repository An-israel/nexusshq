
-- Helper: workspace-scoped manager/admin check
CREATE OR REPLACE FUNCTION public.is_workspace_manager(_workspace_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = _workspace_id
      AND user_id = _user_id
      AND is_active = true
      AND role IN ('owner','admin','manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.shares_workspace_with(_target_user_id uuid, _actor_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members me
    JOIN public.workspace_members them ON them.workspace_id = me.workspace_id
    WHERE me.user_id = _actor_user_id AND me.is_active = true
      AND me.role IN ('owner','admin','manager')
      AND them.user_id = _target_user_id AND them.is_active = true
  );
$$;

-- ===== announcements =====
DROP POLICY IF EXISTS "managers/admins create announcements" ON public.announcements;
DROP POLICY IF EXISTS "managers/admins manage announcements" ON public.announcements;
CREATE POLICY "ws managers manage announcements" ON public.announcements
  FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

-- ===== attendance =====
DROP POLICY IF EXISTS "admins manage attendance" ON public.attendance;
DROP POLICY IF EXISTS "managers/admins view all attendance" ON public.attendance;
CREATE POLICY "ws managers manage attendance" ON public.attendance
  FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));
CREATE POLICY "ws managers view attendance" ON public.attendance
  FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

-- ===== burnout_alerts (no workspace_id; scope via target user shared workspace) =====
DROP POLICY IF EXISTS "managers acknowledge burnout alerts" ON public.burnout_alerts;
DROP POLICY IF EXISTS "managers view burnout alerts" ON public.burnout_alerts;
CREATE POLICY "ws managers view burnout alerts" ON public.burnout_alerts
  FOR SELECT TO authenticated
  USING (public.shares_workspace_with(user_id, auth.uid()));
CREATE POLICY "ws managers ack burnout alerts" ON public.burnout_alerts
  FOR UPDATE TO authenticated
  USING (public.shares_workspace_with(user_id, auth.uid()));

-- ===== client_projects =====
DROP POLICY IF EXISTS "managers manage client projects" ON public.client_projects;
CREATE POLICY "ws managers manage client projects" ON public.client_projects
  FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

-- ===== client_project_tasks =====
DROP POLICY IF EXISTS "managers manage client tasks" ON public.client_project_tasks;
CREATE POLICY "ws managers manage client tasks" ON public.client_project_tasks
  FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

-- ===== deliverables =====
DROP POLICY IF EXISTS "managers/admins review deliverables" ON public.deliverables;
DROP POLICY IF EXISTS "managers/admins view all deliverables" ON public.deliverables;
CREATE POLICY "ws managers review deliverables" ON public.deliverables
  FOR UPDATE TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));
CREATE POLICY "ws managers view deliverables" ON public.deliverables
  FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

-- ===== deliverable_scores =====
DROP POLICY IF EXISTS "managers create scores" ON public.deliverable_scores;
DROP POLICY IF EXISTS "view scores on own deliverables" ON public.deliverable_scores;
CREATE POLICY "ws managers create scores" ON public.deliverable_scores
  FOR INSERT TO authenticated
  WITH CHECK (reviewer_id = auth.uid() AND workspace_id IS NOT NULL
              AND public.is_workspace_manager(workspace_id, auth.uid()));
CREATE POLICY "view scores on own or as manager" ON public.deliverable_scores
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.deliverables d
            WHERE d.id = deliverable_scores.deliverable_id AND d.user_id = auth.uid())
    OR (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()))
  );

-- ===== flags =====
DROP POLICY IF EXISTS "managers/admins manage flags" ON public.flags;
DROP POLICY IF EXISTS "managers/admins view all flags" ON public.flags;
CREATE POLICY "ws managers manage flags" ON public.flags
  FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));
CREATE POLICY "ws managers view flags" ON public.flags
  FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

-- ===== kpis =====
DROP POLICY IF EXISTS "admins manage kpis" ON public.kpis;
CREATE POLICY "ws managers manage kpis" ON public.kpis
  FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

-- ===== leave_balances =====
DROP POLICY IF EXISTS "managers manage balances" ON public.leave_balances;
DROP POLICY IF EXISTS "users view own balances" ON public.leave_balances;
CREATE POLICY "ws managers manage balances" ON public.leave_balances
  FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));
CREATE POLICY "users view own or manager balances" ON public.leave_balances
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid())));

-- ===== leave_requests =====
DROP POLICY IF EXISTS "managers review requests" ON public.leave_requests;
DROP POLICY IF EXISTS "users view own requests" ON public.leave_requests;
CREATE POLICY "ws managers review requests" ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));
CREATE POLICY "users view own or manager requests" ON public.leave_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid())));

-- ===== payslips =====
DROP POLICY IF EXISTS "admins manage payslips" ON public.payslips;
CREATE POLICY "ws managers manage payslips" ON public.payslips
  FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

-- ===== performance_reviews =====
DROP POLICY IF EXISTS "managers/admins manage reviews" ON public.performance_reviews;
CREATE POLICY "ws managers manage reviews" ON public.performance_reviews
  FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

-- ===== recurring_tasks =====
DROP POLICY IF EXISTS "managers manage recurring" ON public.recurring_tasks;
DROP POLICY IF EXISTS "managers view all recurring" ON public.recurring_tasks;
CREATE POLICY "ws managers manage recurring" ON public.recurring_tasks
  FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));
CREATE POLICY "ws managers view recurring" ON public.recurring_tasks
  FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

-- ===== standups =====
DROP POLICY IF EXISTS "managers view all standups" ON public.standups;
CREATE POLICY "ws managers view standups" ON public.standups
  FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

-- ===== tasks =====
DROP POLICY IF EXISTS "managers/admins manage tasks" ON public.tasks;
DROP POLICY IF EXISTS "managers/admins view all tasks" ON public.tasks;
CREATE POLICY "ws managers manage tasks" ON public.tasks
  FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));
CREATE POLICY "ws managers view tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

-- ===== wiki_pages =====
DROP POLICY IF EXISTS "managers manage wiki pages" ON public.wiki_pages;
CREATE POLICY "ws managers manage wiki pages" ON public.wiki_pages
  FOR ALL TO authenticated
  USING (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()))
  WITH CHECK (workspace_id IS NOT NULL AND public.is_workspace_manager(workspace_id, auth.uid()));

-- ===== user_roles (legacy, global) — remove manager privilege escalation paths =====
DROP POLICY IF EXISTS "managers insert non-admin roles" ON public.user_roles;
DROP POLICY IF EXISTS "managers delete roles" ON public.user_roles;

-- ===== feature_flags: workspace-scoped read =====
DROP POLICY IF EXISTS "feature_flags readable by authenticated" ON public.feature_flags;
CREATE POLICY "feature_flags ws members read" ON public.feature_flags
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- ===== Storage: avatars =====
DROP POLICY IF EXISTS "avatars upload" ON storage.objects;
DROP POLICY IF EXISTS "avatars read" ON storage.objects;
-- Keep "anyone view avatars" SELECT policy and the path-scoped insert/update/delete policies

-- ===== Storage: standup-screenshots =====
DROP POLICY IF EXISTS "standup screenshots auth upload" ON storage.objects;
DROP POLICY IF EXISTS "standup screenshots auth update" ON storage.objects;
CREATE POLICY "standup screenshots own upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'standup-screenshots'
              AND (storage.foldername(name))[1] = (auth.uid())::text);
CREATE POLICY "standup screenshots own update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'standup-screenshots'
         AND (storage.foldername(name))[1] = (auth.uid())::text);

-- ===== Realtime: require authentication to subscribe =====
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated can receive realtime" ON realtime.messages;
CREATE POLICY "authenticated can receive realtime" ON realtime.messages
  FOR SELECT TO authenticated
  USING (true);
