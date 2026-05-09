-- Invite tokens + passcodes: no email required.
-- Admins/managers generate a link + passcode; employees redeem it on /join.

CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  token        TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  passcode     TEXT        NOT NULL,
  email        TEXT        NOT NULL,
  full_name    TEXT        NOT NULL,
  job_title    TEXT,
  department   public.department_type NOT NULL DEFAULT 'other',
  phone        TEXT,
  role         public.app_role NOT NULL DEFAULT 'employee',
  invited_by   UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  used_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Workspace members can view invitations for their workspace (e.g. to list or revoke)
DROP POLICY IF EXISTS "invitations select" ON public.workspace_invitations;
CREATE POLICY "invitations select" ON public.workspace_invitations
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- Authenticated users (managers/admins — enforced at app layer) can create invitations
DROP POLICY IF EXISTS "invitations insert" ON public.workspace_invitations;
CREATE POLICY "invitations insert" ON public.workspace_invitations
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- Only the creator or an admin can delete/revoke an invitation
DROP POLICY IF EXISTS "invitations delete" ON public.workspace_invitations;
CREATE POLICY "invitations delete" ON public.workspace_invitations
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (SELECT public.get_my_workspace_ids())
    AND (
      invited_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'admin'
      )
    )
  );
