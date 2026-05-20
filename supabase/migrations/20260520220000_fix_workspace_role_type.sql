-- workspace_role type was referenced in several functions but never defined.
-- The actual enum is workspace_member_role. Create workspace_role as an alias
-- so all existing functions continue to work, then redefine create_workspace_with_owner.

DO $$ BEGIN
  CREATE TYPE public.workspace_role AS ENUM ('owner','admin','manager','employee');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Redefine create_workspace_with_owner using the correct types
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
  VALUES (btrim(_name), _slug, 'starter', true)
  RETURNING workspaces.id, workspaces.slug INTO ws_id, ws_slug;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, is_active)
  VALUES (ws_id, auth.uid(), 'owner', true);

  -- Create a default subscription entry
  INSERT INTO public.subscriptions (workspace_id, plan, status, current_period_start, current_period_end)
  VALUES (ws_id, 'starter', 'active', now(), now() + interval '30 days')
  ON CONFLICT DO NOTHING;

  RETURN QUERY SELECT ws_id, ws_slug;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_workspace_with_owner(text, text) TO authenticated;

-- Redefine ensure_skryve_seed with the correct type reference
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

  INSERT INTO public.workspace_members (workspace_id, user_id, role, is_active)
  SELECT ws_id, p.id, 'owner', true
  FROM public.profiles p
  WHERE lower(coalesce(p.email,'')) IN ('skryveai@gmail.com','aniekaneazy@gmail.com')
    AND NOT EXISTS (
      SELECT 1 FROM public.workspace_members wm
      WHERE wm.workspace_id = ws_id AND wm.user_id = p.id
    );

  RETURN ws_id;
END;
$$;
