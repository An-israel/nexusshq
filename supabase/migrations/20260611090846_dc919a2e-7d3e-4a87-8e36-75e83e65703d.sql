-- Restrict webhook_endpoints SELECT to workspace admins/owners only
DROP POLICY IF EXISTS "Workspace members can view webhooks" ON public.webhook_endpoints;
CREATE POLICY "Workspace admins can view webhooks"
  ON public.webhook_endpoints
  FOR SELECT
  TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()));

-- Restrict audit_events SELECT to workspace admins/managers only
DROP POLICY IF EXISTS "Workspace members can view audit events" ON public.audit_events;
CREATE POLICY "Workspace managers can view audit events"
  ON public.audit_events
  FOR SELECT
  TO authenticated
  USING (public.is_workspace_manager(workspace_id, auth.uid()));
