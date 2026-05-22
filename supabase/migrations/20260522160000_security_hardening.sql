-- ============================================================
-- SECURITY HARDENING — fixes all Supabase security advisor errors/warnings
-- ============================================================

-- ── 1. SECURITY DEFINER helper functions: revoke from anon/public ──────────
-- "Public Can Execute SECURITY DEFINER Function" warning
REVOKE EXECUTE ON FUNCTION public.get_my_workspace_ids() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_workspace_ids() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_my_admin_workspace_ids() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_admin_workspace_ids() TO authenticated;

-- ── 2. OKRs: require auth + workspace scope (was: USING (true) = unauthenticated read) ──
DROP POLICY IF EXISTS "all users view objectives"        ON public.objectives;
DROP POLICY IF EXISTS "managers manage objectives"       ON public.objectives;
CREATE POLICY "objectives_select" ON public.objectives
  FOR SELECT TO authenticated USING (
    workspace_id IN (SELECT public.get_my_workspace_ids())
  );
CREATE POLICY "objectives_write" ON public.objectives
  FOR ALL TO authenticated
  USING     (workspace_id IN (SELECT public.get_my_admin_workspace_ids()))
  WITH CHECK(workspace_id IN (SELECT public.get_my_admin_workspace_ids()));

DROP POLICY IF EXISTS "all users view key results"           ON public.key_results;
DROP POLICY IF EXISTS "managers insert/delete key results"   ON public.key_results;
DROP POLICY IF EXISTS "managers delete key results"          ON public.key_results;
DROP POLICY IF EXISTS "any user updates key result progress" ON public.key_results;
CREATE POLICY "key_results_select" ON public.key_results
  FOR SELECT TO authenticated USING (
    workspace_id IN (SELECT public.get_my_workspace_ids())
  );
-- Any workspace member can update progress values (but must be in the workspace)
CREATE POLICY "key_results_update" ON public.key_results
  FOR UPDATE TO authenticated USING (
    workspace_id IN (SELECT public.get_my_workspace_ids())
  );
-- Only admins/owners can insert or delete
CREATE POLICY "key_results_admin_write" ON public.key_results
  FOR ALL TO authenticated
  USING     (workspace_id IN (SELECT public.get_my_admin_workspace_ids()))
  WITH CHECK(workspace_id IN (SELECT public.get_my_admin_workspace_ids()));

DROP POLICY IF EXISTS "all users view kr updates"  ON public.key_result_updates;
DROP POLICY IF EXISTS "any user inserts kr update" ON public.key_result_updates;
CREATE POLICY "kr_updates_select" ON public.key_result_updates
  FOR SELECT TO authenticated USING (
    key_result_id IN (
      SELECT id FROM public.key_results
      WHERE workspace_id IN (SELECT public.get_my_workspace_ids())
    )
  );
CREATE POLICY "kr_updates_insert" ON public.key_result_updates
  FOR INSERT TO authenticated WITH CHECK (
    updated_by = auth.uid()
    AND key_result_id IN (
      SELECT id FROM public.key_results
      WHERE workspace_id IN (SELECT public.get_my_workspace_ids())
    )
  );

-- ── 3. Client portal: SECURITY DEFINER RPC replaces public table access ────
-- Replace "public read" policies (USING true) with a proper token-gated function.
DROP POLICY IF EXISTS "public read client projects" ON public.client_projects;
DROP POLICY IF EXISTS "public read client tasks"    ON public.client_project_tasks;
DROP POLICY IF EXISTS "managers manage client tasks" ON public.client_project_tasks;
DROP POLICY IF EXISTS "managers manage client projects" ON public.client_projects;

-- Workspace members can read projects in their workspace
DROP POLICY IF EXISTS "client_projects select" ON public.client_projects;
CREATE POLICY "client_projects_select" ON public.client_projects
  FOR SELECT TO authenticated USING (
    workspace_id IN (SELECT public.get_my_workspace_ids())
  );
-- Admins/managers can write
DROP POLICY IF EXISTS "client_projects insert" ON public.client_projects;
DROP POLICY IF EXISTS "client_projects update" ON public.client_projects;
DROP POLICY IF EXISTS "client_projects delete" ON public.client_projects;
CREATE POLICY "client_projects_write" ON public.client_projects
  FOR ALL TO authenticated
  USING     (workspace_id IN (SELECT public.get_my_admin_workspace_ids()))
  WITH CHECK(workspace_id IN (SELECT public.get_my_admin_workspace_ids()));

-- Tasks: workspace members read, admins/managers write
DROP POLICY IF EXISTS "client_tasks_select" ON public.client_project_tasks;
CREATE POLICY "client_tasks_select" ON public.client_project_tasks
  FOR SELECT TO authenticated USING (
    project_id IN (
      SELECT id FROM public.client_projects
      WHERE workspace_id IN (SELECT public.get_my_workspace_ids())
    )
  );
CREATE POLICY "client_tasks_write" ON public.client_project_tasks
  FOR ALL TO authenticated
  USING (
    project_id IN (
      SELECT id FROM public.client_projects
      WHERE workspace_id IN (SELECT public.get_my_admin_workspace_ids())
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.client_projects
      WHERE workspace_id IN (SELECT public.get_my_admin_workspace_ids())
    )
  );

-- SECURITY DEFINER RPC for the public client portal (/track/:token)
-- Clients (unauthenticated) call this instead of querying the table directly.
CREATE OR REPLACE FUNCTION public.get_client_portal_data(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_project jsonb;
  v_tasks   jsonb;
BEGIN
  SELECT to_jsonb(cp) - 'access_token'   -- never expose the token itself
  INTO v_project
  FROM client_projects cp
  WHERE cp.access_token = p_token
    AND cp.status != 'deleted';

  IF v_project IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_agg(to_jsonb(t) ORDER BY t.order_index, t.created_at)
  INTO v_tasks
  FROM client_project_tasks t
  WHERE t.project_id = (v_project->>'id')::uuid;

  RETURN jsonb_build_object(
    'project', v_project,
    'tasks',   COALESCE(v_tasks, '[]'::jsonb)
  );
END;
$$;

-- Only authenticated and anon can call (anon = client portal visitors)
REVOKE EXECUTE ON FUNCTION public.get_client_portal_data(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_client_portal_data(text) TO anon;
GRANT  EXECUTE ON FUNCTION public.get_client_portal_data(text) TO authenticated;

-- ── 4. Workspace invitations: restrict passcode to admins/managers only ─────
-- (was: any workspace member could see token + passcode)
DROP POLICY IF EXISTS "invitations select"   ON public.workspace_invitations;
DROP POLICY IF EXISTS "invitations_select"   ON public.workspace_invitations;
CREATE POLICY "invitations_select" ON public.workspace_invitations
  FOR SELECT TO authenticated USING (
    workspace_id IN (SELECT public.get_my_admin_workspace_ids())
  );

-- ── 5. Burnout alerts: prevent fabrication by any user ─────────────────────
-- Service role (cron) bypasses RLS; authenticated users should NOT insert directly.
DROP POLICY IF EXISTS "service role inserts burnout alerts" ON public.burnout_alerts;
-- Only managers/admins can insert (system cron uses service role which bypasses RLS)
CREATE POLICY "managers insert burnout alerts" ON public.burnout_alerts
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin', 'manager')
        AND wm.is_active = true
    )
  );

-- ── 6. Standup screenshots: make bucket private (was: public = world-readable) ──
UPDATE storage.buckets SET public = false WHERE id = 'standup-screenshots';

DROP POLICY IF EXISTS "standup screenshots public read"      ON storage.objects;
DROP POLICY IF EXISTS "public read screenshots"              ON storage.objects;
DROP POLICY IF EXISTS "standup screenshots auth read"        ON storage.objects;
CREATE POLICY "standup screenshots authenticated read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'standup-screenshots');

-- ── 7. Message attachments: restrict read to uploader's workspace ───────────
-- Path format: {workspaceId}/{channelId}/{filename}
DROP POLICY IF EXISTS "message attachments read" ON storage.objects;
CREATE POLICY "message attachments read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'message-attachments'
    AND EXISTS (
      SELECT 1 FROM public.get_my_workspace_ids() AS ws_id
      WHERE ws_id::text = (storage.foldername(name))[1]
    )
  );

-- ── 8. Employee documents storage: restrict to workspace members ─────────────
-- Path format: {workspaceId}/{userId}/{filename}
DROP POLICY IF EXISTS "authenticated users upload documents" ON storage.objects;
DROP POLICY IF EXISTS "authenticated users read documents"  ON storage.objects;

CREATE POLICY "documents upload" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.get_my_workspace_ids())
  );
CREATE POLICY "documents read" ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1]::uuid IN (SELECT public.get_my_workspace_ids())
  );
