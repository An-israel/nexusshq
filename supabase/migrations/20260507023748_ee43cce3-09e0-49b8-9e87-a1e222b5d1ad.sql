
CREATE OR REPLACE FUNCTION public.autofill_workspace_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ws uuid;
BEGIN
  IF NEW.workspace_id IS NULL THEN
    SELECT workspace_id INTO ws FROM public.workspace_members
      WHERE user_id = auth.uid() AND is_active = true
      ORDER BY created_at ASC LIMIT 1;
    IF ws IS NULL THEN
      SELECT id INTO ws FROM public.workspaces WHERE slug='skryve' LIMIT 1;
    END IF;
    NEW.workspace_id := ws;
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'announcements','attendance','client_portal_views','client_project_tasks','client_projects',
    'deliverable_scores','deliverables','direct_messages','flags','group_messages',
    'key_result_updates','key_results','kpis','leave_balances','leave_requests','leave_types',
    'message_groups','message_group_members','notifications','objectives','payslips','performance_reviews',
    'profiles','recurring_tasks','standups','task_updates','tasks','user_roles','wiki_pages','wiki_sections'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN workspace_id DROP NOT NULL', t);
    EXECUTE format($f$UPDATE public.%I SET workspace_id = (SELECT id FROM public.workspaces WHERE slug='skryve') WHERE workspace_id IS NULL$f$, t);
    EXECUTE format('DROP TRIGGER IF EXISTS autofill_workspace_id_trg ON public.%I', t);
    EXECUTE format('CREATE TRIGGER autofill_workspace_id_trg BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.autofill_workspace_id()', t);
  END LOOP;
END $$;
