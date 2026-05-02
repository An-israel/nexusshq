-- ============================================================
-- FIX: Re-grant has_role to authenticated (migration 4 revoked it
-- but every RLS policy calls it — without EXECUTE the policies error).
-- Also idempotently creates phase-2 tables in case the previous
-- migration file wasn't applied by the host.
-- ============================================================

-- ========== 1. RESTORE FUNCTION GRANTS ==========
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

-- ========== 2. PHASE-2 TABLES (idempotent) ==========

-- Announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  department public.department_type,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='announcements' AND policyname='all auth view announcements') THEN
    CREATE POLICY "all auth view announcements" ON public.announcements FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='announcements' AND policyname='managers/admins create announcements') THEN
    CREATE POLICY "managers/admins create announcements" ON public.announcements FOR INSERT WITH CHECK (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='announcements' AND policyname='managers/admins manage announcements') THEN
    CREATE POLICY "managers/admins manage announcements" ON public.announcements FOR ALL USING (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Direct messages
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS direct_messages_participants_idx ON public.direct_messages(from_id, to_id, created_at DESC);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='direct_messages' AND policyname='users view own messages') THEN
    CREATE POLICY "users view own messages" ON public.direct_messages FOR SELECT USING (from_id = auth.uid() OR to_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='direct_messages' AND policyname='users send messages') THEN
    CREATE POLICY "users send messages" ON public.direct_messages FOR INSERT WITH CHECK (from_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='direct_messages' AND policyname='recipients mark read') THEN
    CREATE POLICY "recipients mark read" ON public.direct_messages FOR UPDATE USING (to_id = auth.uid());
  END IF;
END $$;

-- Org chart column on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reports_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Wiki
CREATE TABLE IF NOT EXISTS public.wiki_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.wiki_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID REFERENCES public.wiki_sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.wiki_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wiki_pages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='wiki_sections' AND policyname='auth view wiki sections') THEN
    CREATE POLICY "auth view wiki sections" ON public.wiki_sections FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='wiki_sections' AND policyname='managers manage wiki sections') THEN
    CREATE POLICY "managers manage wiki sections" ON public.wiki_sections FOR ALL USING (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='wiki_pages' AND policyname='auth view wiki pages') THEN
    CREATE POLICY "auth view wiki pages" ON public.wiki_pages FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='wiki_pages' AND policyname='managers manage wiki pages') THEN
    CREATE POLICY "managers manage wiki pages" ON public.wiki_pages FOR ALL USING (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Deliverable quality scores
CREATE TABLE IF NOT EXISTS public.deliverable_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id UUID NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quality_score INT NOT NULL DEFAULT 3 CHECK (quality_score BETWEEN 1 AND 5),
  creativity_score INT NOT NULL DEFAULT 3 CHECK (creativity_score BETWEEN 1 AND 5),
  timeliness_score INT NOT NULL DEFAULT 3 CHECK (timeliness_score BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deliverable_id, reviewer_id)
);
ALTER TABLE public.deliverable_scores ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deliverable_scores' AND policyname='view scores on own deliverables') THEN
    CREATE POLICY "view scores on own deliverables" ON public.deliverable_scores
      FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.deliverables d WHERE d.id = deliverable_id AND d.user_id = auth.uid())
        OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin')
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deliverable_scores' AND policyname='managers create scores') THEN
    CREATE POLICY "managers create scores" ON public.deliverable_scores
      FOR INSERT WITH CHECK (reviewer_id = auth.uid() AND (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='deliverable_scores' AND policyname='managers update scores') THEN
    CREATE POLICY "managers update scores" ON public.deliverable_scores FOR UPDATE USING (reviewer_id = auth.uid());
  END IF;
END $$;

-- Recurring tasks
CREATE TABLE IF NOT EXISTS public.recurring_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  kpi_id UUID REFERENCES public.kpis(id) ON DELETE SET NULL,
  priority public.task_priority NOT NULL DEFAULT 'medium',
  recurrence TEXT NOT NULL DEFAULT 'weekly' CHECK (recurrence IN ('daily', 'weekly')),
  day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_generated_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recurring_tasks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recurring_tasks' AND policyname='employees view own recurring') THEN
    CREATE POLICY "employees view own recurring" ON public.recurring_tasks FOR SELECT USING (assigned_to = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recurring_tasks' AND policyname='managers view all recurring') THEN
    CREATE POLICY "managers view all recurring" ON public.recurring_tasks FOR SELECT USING (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='recurring_tasks' AND policyname='managers manage recurring') THEN
    CREATE POLICY "managers manage recurring" ON public.recurring_tasks
      FOR ALL USING (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'))
      WITH CHECK (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Standups
CREATE TABLE IF NOT EXISTS public.standups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  yesterday TEXT NOT NULL,
  today TEXT NOT NULL,
  blockers TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);
ALTER TABLE public.standups ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS standups_date_idx ON public.standups(date DESC, user_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='standups' AND policyname='users view own standups') THEN
    CREATE POLICY "users view own standups" ON public.standups FOR SELECT USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='standups' AND policyname='users create standups') THEN
    CREATE POLICY "users create standups" ON public.standups FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='standups' AND policyname='users update own standups') THEN
    CREATE POLICY "users update own standups" ON public.standups FOR UPDATE USING (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='standups' AND policyname='managers view all standups') THEN
    CREATE POLICY "managers view all standups" ON public.standups FOR SELECT USING (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Client projects
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS public.client_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on_hold')),
  access_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64'),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.client_project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.client_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.client_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_project_tasks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_projects' AND policyname='managers manage client projects') THEN
    CREATE POLICY "managers manage client projects" ON public.client_projects
      FOR ALL USING (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_project_tasks' AND policyname='managers manage client tasks') THEN
    CREATE POLICY "managers manage client tasks" ON public.client_project_tasks
      FOR ALL USING (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_projects' AND policyname='public read client projects') THEN
    CREATE POLICY "public read client projects" ON public.client_projects FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_project_tasks' AND policyname='public read client tasks') THEN
    CREATE POLICY "public read client tasks" ON public.client_project_tasks FOR SELECT USING (true);
  END IF;
END $$;

-- ========== 3. REALTIME FOR PHASE-2 TABLES ==========
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'announcements','direct_messages','standups','recurring_tasks','client_project_tasks'
  ]) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ========== 4. NOTIFY POSTGREST TO RELOAD SCHEMA CACHE ==========
NOTIFY pgrst, 'reload schema';
