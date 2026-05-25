
-- 1) client_projects.access_token: restrict column-level read to service_role + secure RPC for managers/admins
REVOKE SELECT (access_token) ON public.client_projects FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_client_project_token(_project_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws_id uuid;
  tok text;
BEGIN
  SELECT workspace_id, access_token INTO ws_id, tok
  FROM public.client_projects WHERE id = _project_id;
  IF ws_id IS NULL THEN RETURN NULL; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
      AND is_active = true AND role IN ('owner','admin','manager')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN tok;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_client_project_token(uuid) TO authenticated;

-- 2) Documents storage: require ownership/admin
DROP POLICY IF EXISTS "documents owner or admin read" ON storage.objects;
CREATE POLICY "documents owner or admin read" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.documents d
    WHERE d.file_url = objects.name
      AND (
        d.user_id = auth.uid()
        OR d.uploaded_by = auth.uid()
        OR public.is_workspace_admin(d.workspace_id, auth.uid())
      )
  )
);

-- 3) key_results UPDATE: workspace scope
DROP POLICY IF EXISTS "auth update key result progress" ON public.key_results;
CREATE POLICY "members update key result progress" ON public.key_results
FOR UPDATE TO authenticated
USING (workspace_id IN (SELECT public.get_my_workspace_ids()))
WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- Also scope SELECT to workspace (was true) for consistency
DROP POLICY IF EXISTS "auth view key results" ON public.key_results;
CREATE POLICY "members view key results" ON public.key_results
FOR SELECT TO authenticated
USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- 4) messages UPDATE: only sender (admins can still moderate via service_role)
DROP POLICY IF EXISTS "messages update" ON public.messages;
CREATE POLICY "messages update own" ON public.messages
FOR UPDATE TO authenticated
USING (
  workspace_id IN (SELECT public.get_my_workspace_ids())
  AND sender_id = auth.uid()
)
WITH CHECK (
  workspace_id IN (SELECT public.get_my_workspace_ids())
  AND sender_id = auth.uid()
);

-- 5) subscriptions INSERT: admins only
DROP POLICY IF EXISTS "authenticated create subscription" ON public.subscriptions;
CREATE POLICY "admins create subscription" ON public.subscriptions
FOR INSERT TO authenticated
WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()));

-- 6) workspace_invitations: hide token/passcode from non-admins via column privileges + RPC
REVOKE SELECT (token, passcode) ON public.workspace_invitations FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.get_workspace_invitation_secret(_invitation_id uuid)
RETURNS TABLE(token text, passcode text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ws_id uuid;
BEGIN
  SELECT workspace_id INTO ws_id FROM public.workspace_invitations WHERE id = _invitation_id;
  IF ws_id IS NULL THEN RETURN; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
      AND is_active = true AND role IN ('owner','admin','manager')
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY SELECT wi.token, wi.passcode FROM public.workspace_invitations wi WHERE wi.id = _invitation_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_workspace_invitation_secret(uuid) TO authenticated;
