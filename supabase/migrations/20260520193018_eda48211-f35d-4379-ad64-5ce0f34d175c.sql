
CREATE OR REPLACE FUNCTION public.create_workspace_with_owner(_name text, _slug text)
RETURNS TABLE(id uuid, slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws_id uuid;
  ws_slug text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _name IS NULL OR length(btrim(_name)) = 0 THEN
    RAISE EXCEPTION 'Workspace name is required';
  END IF;

  IF _slug !~ '^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$' THEN
    RAISE EXCEPTION 'Invalid workspace URL';
  END IF;

  IF EXISTS (SELECT 1 FROM public.workspaces w WHERE w.slug = _slug) THEN
    RAISE EXCEPTION 'Workspace URL already taken';
  END IF;

  INSERT INTO public.workspaces (name, slug, plan, is_active)
  VALUES (btrim(_name), _slug, 'starter'::workspace_plan, true)
  RETURNING workspaces.id, workspaces.slug INTO ws_id, ws_slug;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, is_active)
  VALUES (ws_id, auth.uid(), 'owner'::workspace_role, true);

  RETURN QUERY SELECT ws_id, ws_slug;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_workspace_with_owner(text, text) TO authenticated;
