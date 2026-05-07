CREATE OR REPLACE FUNCTION public.ensure_skryve_seed()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  SELECT
    ws_id,
    p.id,
    CASE WHEN lower(coalesce(p.email,'')) IN ('skryveai@gmail.com','aniekaneazy@gmail.com')
         THEN 'owner'::workspace_role
         ELSE 'employee'::workspace_role
    END,
    true
  FROM public.profiles p
  WHERE NOT EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = ws_id AND wm.user_id = p.id
  );

  RETURN ws_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_skryve_seed() TO authenticated;