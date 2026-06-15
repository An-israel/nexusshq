-- Two RLS bugs that block workspace owners (and, for invoices, admins) from
-- doing their job:
--
-- 1. invoices: "workspace_admins_view_invoices" joined the legacy
--    `user_roles` table instead of `workspace_members.role`, and allowed
--    'manager' (billing should be owner/admin only, per is_workspace_admin).
--    A workspace owner with no `user_roles` row could not see invoices at
--    all, while managers incorrectly could.
--
-- 2. documents: the select/insert/update/delete policies checked
--    `wm.role in ('admin','manager')`, omitting 'owner' entirely — workspace
--    owners could not view, upload, update, or delete workspace documents.

DROP POLICY IF EXISTS "workspace_admins_view_invoices" ON invoices;
CREATE POLICY "workspace_admins_view_invoices" ON invoices
  FOR SELECT
  USING (public.is_workspace_admin(invoices.workspace_id, auth.uid()));

DROP POLICY IF EXISTS "employees see own documents" ON documents;
CREATE POLICY "employees see own documents"
  ON documents FOR SELECT USING (
    user_id = auth.uid()
    OR uploaded_by = auth.uid()
    OR public.is_workspace_manager(documents.workspace_id, auth.uid())
  );

DROP POLICY IF EXISTS "managers insert documents" ON documents;
CREATE POLICY "managers insert documents"
  ON documents FOR INSERT WITH CHECK (
    public.is_workspace_manager(documents.workspace_id, auth.uid())
  );

DROP POLICY IF EXISTS "managers update documents" ON documents;
CREATE POLICY "managers update documents"
  ON documents FOR UPDATE USING (
    public.is_workspace_manager(documents.workspace_id, auth.uid())
  );

DROP POLICY IF EXISTS "managers delete documents" ON documents;
CREATE POLICY "managers delete documents"
  ON documents FOR DELETE USING (
    public.is_workspace_manager(documents.workspace_id, auth.uid())
  );
