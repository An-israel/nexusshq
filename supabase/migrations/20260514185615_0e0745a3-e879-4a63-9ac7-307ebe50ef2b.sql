
-- 1. workspace_invites table
CREATE TABLE IF NOT EXISTS public.workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role workspace_member_role NOT NULL DEFAULT 'employee',
  token text NOT NULL UNIQUE DEFAULT replace(replace(replace(encode(extensions.gen_random_bytes(24),'base64'),'+','-'),'/','_'),'=',''),
  invited_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS workspace_invites_workspace_id_idx ON public.workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS workspace_invites_email_idx ON public.workspace_invites(lower(email));

ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace admins manage invites" ON public.workspace_invites;
CREATE POLICY "workspace admins manage invites" ON public.workspace_invites
  FOR ALL TO authenticated
  USING (public.is_workspace_admin(workspace_id, auth.uid()) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_workspace_admin(workspace_id, auth.uid()) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "invitee reads own pending invite" ON public.workspace_invites;
CREATE POLICY "invitee reads own pending invite" ON public.workspace_invites
  FOR SELECT TO authenticated
  USING (lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')));

-- 2. Redeem invite (security definer)
CREATE OR REPLACE FUNCTION public.redeem_workspace_invite(_token text)
RETURNS TABLE(workspace_id uuid, slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  user_email text;
  ws_slug text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  user_email := lower(coalesce((auth.jwt() ->> 'email'), ''));

  SELECT * INTO inv FROM public.workspace_invites
    WHERE token = _token AND accepted_at IS NULL
    LIMIT 1;

  IF inv IS NULL THEN RAISE EXCEPTION 'Invite not found or already used'; END IF;
  IF inv.expires_at < now() THEN RAISE EXCEPTION 'Invite expired'; END IF;
  IF lower(inv.email) <> user_email THEN
    RAISE EXCEPTION 'This invite is for %, but you are signed in as %', inv.email, user_email;
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, is_active)
  VALUES (inv.workspace_id, auth.uid(), inv.role, true)
  ON CONFLICT (workspace_id, user_id)
  DO UPDATE SET is_active = true, role = EXCLUDED.role;

  UPDATE public.workspace_invites
    SET accepted_at = now(), accepted_by = auth.uid()
    WHERE id = inv.id;

  SELECT w.slug INTO ws_slug FROM public.workspaces w WHERE w.id = inv.workspace_id;

  RETURN QUERY SELECT inv.workspace_id, ws_slug;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_workspace_invite(text) TO authenticated;

-- 3. Super-admin: create workspace + assign owner by email
CREATE OR REPLACE FUNCTION public.super_admin_create_workspace(
  _name text, _slug text, _plan workspace_plan, _owner_email text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws_id uuid;
  owner_id uuid;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'Forbidden'; END IF;

  INSERT INTO public.workspaces (name, slug, plan, is_active)
  VALUES (_name, _slug, _plan, true)
  RETURNING id INTO ws_id;

  IF _owner_email IS NOT NULL AND _owner_email <> '' THEN
    SELECT id INTO owner_id FROM public.profiles WHERE lower(email) = lower(_owner_email) LIMIT 1;
    IF owner_id IS NOT NULL THEN
      INSERT INTO public.workspace_members (workspace_id, user_id, role, is_active)
      VALUES (ws_id, owner_id, 'owner', true)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN ws_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.super_admin_create_workspace(text, text, workspace_plan, text) TO authenticated;

-- 4. Super admin manage workspace_members (delete + insert policies)
DROP POLICY IF EXISTS "super admins manage memberships" ON public.workspace_members;
CREATE POLICY "super admins manage memberships" ON public.workspace_members
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
