-- Add 'info' to notification_type enum
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'info';

-- leave_types
CREATE TABLE IF NOT EXISTS public.leave_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  days_per_year integer NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT 'blue',
  requires_approval boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth view leave types" ON public.leave_types;
CREATE POLICY "auth view leave types" ON public.leave_types
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "managers manage leave types" ON public.leave_types;
CREATE POLICY "managers manage leave types" ON public.leave_types
  FOR ALL USING (has_role(auth.uid(),'manager') OR has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'manager') OR has_role(auth.uid(),'admin'));

-- leave_balances
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
  year integer NOT NULL,
  days_allocated numeric NOT NULL DEFAULT 0,
  days_used numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, leave_type_id, year)
);
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users view own balances" ON public.leave_balances;
CREATE POLICY "users view own balances" ON public.leave_balances
  FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "managers manage balances" ON public.leave_balances;
CREATE POLICY "managers manage balances" ON public.leave_balances
  FOR ALL USING (has_role(auth.uid(),'manager') OR has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'manager') OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "users insert own balances" ON public.leave_balances;
CREATE POLICY "users insert own balances" ON public.leave_balances
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- leave_requests
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  leave_type_id uuid NOT NULL REFERENCES public.leave_types(id) ON DELETE RESTRICT,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_requested numeric NOT NULL DEFAULT 1,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  reviewer_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users view own requests" ON public.leave_requests;
CREATE POLICY "users view own requests" ON public.leave_requests
  FOR SELECT USING (user_id = auth.uid() OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "users create own requests" ON public.leave_requests;
CREATE POLICY "users create own requests" ON public.leave_requests
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "users update own pending" ON public.leave_requests;
CREATE POLICY "users update own pending" ON public.leave_requests
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "managers review requests" ON public.leave_requests;
CREATE POLICY "managers review requests" ON public.leave_requests
  FOR UPDATE USING (has_role(auth.uid(),'manager') OR has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'manager') OR has_role(auth.uid(),'admin'));

-- init_leave_balances RPC
CREATE OR REPLACE FUNCTION public.init_leave_balances(p_user_id uuid, p_year integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.leave_balances (user_id, leave_type_id, year, days_allocated, days_used)
  SELECT p_user_id, lt.id, p_year, lt.days_per_year, 0
  FROM public.leave_types lt
  ON CONFLICT (user_id, leave_type_id, year) DO NOTHING;
END;
$$;

-- client_portal_views
CREATE TABLE IF NOT EXISTS public.client_portal_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.client_projects(id) ON DELETE CASCADE,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  user_agent text
);
ALTER TABLE public.client_portal_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone insert portal view" ON public.client_portal_views;
CREATE POLICY "anyone insert portal view" ON public.client_portal_views
  FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "managers view portal views" ON public.client_portal_views;
CREATE POLICY "managers view portal views" ON public.client_portal_views
  FOR SELECT USING (has_role(auth.uid(),'manager') OR has_role(auth.uid(),'admin'));

-- Seed default leave types if empty
INSERT INTO public.leave_types (name, days_per_year, color, requires_approval)
SELECT * FROM (VALUES
  ('Annual Leave', 20, 'blue', true),
  ('Sick Leave', 10, 'amber', false),
  ('Personal', 5, 'purple', true)
) AS v(name, days_per_year, color, requires_approval)
WHERE NOT EXISTS (SELECT 1 FROM public.leave_types);