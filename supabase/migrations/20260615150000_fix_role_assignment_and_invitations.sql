-- Three bugs that block admins/managers from assigning roles and managing
-- invitations correctly:
--
-- 1. workspace_members had NO policy letting managers update a member's row
--    (only "workspace_members admins manage" / "admins manage memberships",
--    both gated on is_workspace_admin = owner/admin). Per the role spec,
--    managers should be able to assign employee/manager roles to team
--    members — but any such UPDATE was rejected by RLS. Add a policy that
--    lets workspace managers update members whose current role is
--    employee/manager, and only ever set the new role to employee/manager
--    (never admin/owner).
--
-- 2. workspace_invitations "invitations delete" checked the legacy global
--    `user_roles` table for role = 'admin', so a workspace owner/admin with
--    no `user_roles` row could never revoke an invitation. Switch to
--    is_workspace_admin(workspace_id, auth.uid()) (owner+admin), matching
--    the spec ("Admin/Owner can invite/remove").
--
-- 3. workspace_invitations "invitations insert" allowed ANY workspace member
--    to create an invitation with ANY role (including 'admin'), with no
--    role-based restriction. Restrict to managers+ (is_workspace_manager),
--    and forbid managers from creating admin invitations — only
--    owner/admin can invite as admin, matching "Manager ... can invite
--    employees and assign employee/manager roles. Cannot ... assign/change
--    admin roles."

DROP POLICY IF EXISTS "managers update member roles" ON public.workspace_members;
CREATE POLICY "managers update member roles" ON public.workspace_members
  FOR UPDATE TO authenticated
  USING (
    public.is_workspace_manager(workspace_id, auth.uid())
    AND role NOT IN ('owner', 'admin')
  )
  WITH CHECK (
    public.is_workspace_manager(workspace_id, auth.uid())
    AND role IN ('employee', 'manager')
  );

DROP POLICY IF EXISTS "invitations delete" ON public.workspace_invitations;
CREATE POLICY "invitations delete" ON public.workspace_invitations
  FOR DELETE TO authenticated
  USING (
    workspace_id IN (SELECT public.get_my_workspace_ids())
    AND (
      invited_by = auth.uid()
      OR public.is_workspace_admin(workspace_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "invitations insert" ON public.workspace_invitations;
CREATE POLICY "invitations insert" ON public.workspace_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_workspace_manager(workspace_id, auth.uid())
    AND (
      role IN ('employee', 'manager')
      OR public.is_workspace_admin(workspace_id, auth.uid())
    )
  );
