
-- 1) Tenant isolation: drop NULL workspace_id branch from SELECT policies
DROP POLICY IF EXISTS "members view announcements" ON public.announcements;
CREATE POLICY "members view announcements" ON public.announcements FOR SELECT TO authenticated
USING (workspace_id IN (SELECT get_my_workspace_ids()));

DROP POLICY IF EXISTS "members view wiki pages" ON public.wiki_pages;
CREATE POLICY "members view wiki pages" ON public.wiki_pages FOR SELECT TO authenticated
USING (workspace_id IN (SELECT get_my_workspace_ids()));

DROP POLICY IF EXISTS "members view wiki sections" ON public.wiki_sections;
CREATE POLICY "members view wiki sections" ON public.wiki_sections FOR SELECT TO authenticated
USING (workspace_id IN (SELECT get_my_workspace_ids()));

DROP POLICY IF EXISTS "members view objectives" ON public.objectives;
CREATE POLICY "members view objectives" ON public.objectives FOR SELECT TO authenticated
USING (workspace_id IN (SELECT get_my_workspace_ids()));

DROP POLICY IF EXISTS "members view kpis" ON public.kpis;
CREATE POLICY "members view kpis" ON public.kpis FOR SELECT TO authenticated
USING (workspace_id IN (SELECT get_my_workspace_ids()));

DROP POLICY IF EXISTS "members view key result updates" ON public.key_result_updates;
CREATE POLICY "members view key result updates" ON public.key_result_updates FOR SELECT TO authenticated
USING (workspace_id IN (SELECT get_my_workspace_ids()));

DROP POLICY IF EXISTS "members view leave types" ON public.leave_types;
CREATE POLICY "members view leave types" ON public.leave_types FOR SELECT TO authenticated
USING (workspace_id IN (SELECT get_my_workspace_ids()));

DROP POLICY IF EXISTS "members view standup comments" ON public.standup_comments;
CREATE POLICY "members view standup comments" ON public.standup_comments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.standups s
    WHERE s.id = standup_comments.standup_id
      AND s.workspace_id IN (SELECT get_my_workspace_ids())
  )
);

-- 2) user_presence: restrict INSERT to caller's workspaces
DROP POLICY IF EXISTS "user_presence insert" ON public.user_presence;
CREATE POLICY "user_presence insert" ON public.user_presence FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND workspace_id IN (SELECT get_my_workspace_ids()));

DROP POLICY IF EXISTS "user_presence update" ON public.user_presence;
CREATE POLICY "user_presence update" ON public.user_presence FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND workspace_id IN (SELECT get_my_workspace_ids()));

-- 3) Workspace-scope admin writes on user_roles
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins view all roles" ON public.user_roles;

CREATE POLICY "ws admins view roles" ON public.user_roles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR (workspace_id IS NOT NULL AND is_workspace_admin(workspace_id, auth.uid()))
);

CREATE POLICY "ws admins insert roles" ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (workspace_id IS NOT NULL AND is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "ws admins update roles" ON public.user_roles FOR UPDATE TO authenticated
USING (workspace_id IS NOT NULL AND is_workspace_admin(workspace_id, auth.uid()))
WITH CHECK (workspace_id IS NOT NULL AND is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "ws admins delete roles" ON public.user_roles FOR DELETE TO authenticated
USING (workspace_id IS NOT NULL AND is_workspace_admin(workspace_id, auth.uid()));

-- 4) Workspace-scope admin writes on feature_flags
DROP POLICY IF EXISTS "feature_flags admins insert" ON public.feature_flags;
DROP POLICY IF EXISTS "feature_flags admins update" ON public.feature_flags;
DROP POLICY IF EXISTS "feature_flags admins delete" ON public.feature_flags;

CREATE POLICY "feature_flags ws admins insert" ON public.feature_flags FOR INSERT TO authenticated
WITH CHECK (is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "feature_flags ws admins update" ON public.feature_flags FOR UPDATE TO authenticated
USING (is_workspace_admin(workspace_id, auth.uid()))
WITH CHECK (is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "feature_flags ws admins delete" ON public.feature_flags FOR DELETE TO authenticated
USING (is_workspace_admin(workspace_id, auth.uid()));

-- 5) Scope admin profile insert to own workspace members
DROP POLICY IF EXISTS "admins insert profiles" ON public.profiles;
CREATE POLICY "ws admins insert profiles" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (
  id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.user_id = profiles.id
      AND is_workspace_admin(wm.workspace_id, auth.uid())
  )
);
