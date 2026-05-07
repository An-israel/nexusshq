
DO $$
DECLARE
  ws uuid;
  t text;
  tables text[] := ARRAY[
    'announcements','attendance','client_portal_views','client_project_tasks','client_projects',
    'deliverable_scores','deliverables','direct_messages','feature_flags','flags','group_messages',
    'key_result_updates','key_results','kpis','leave_balances','leave_requests','leave_types',
    'message_groups','notifications','objectives','payslips','performance_reviews',
    'recurring_tasks','standups','task_updates','tasks','wiki_pages','wiki_sections'
  ];
BEGIN
  SELECT id INTO ws FROM public.workspaces WHERE slug = 'skryve';
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE', t);
    EXECUTE format('UPDATE public.%I SET workspace_id = $1 WHERE workspace_id IS NULL', t) USING ws;
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN workspace_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(workspace_id)', t || '_workspace_id_idx', t);
  END LOOP;
END $$;

ALTER TABLE public.feature_flags DROP CONSTRAINT IF EXISTS feature_flags_pkey;
ALTER TABLE public.feature_flags ADD CONSTRAINT feature_flags_pkey PRIMARY KEY (workspace_id, key);
