-- ============ PHASE D-F SCHEMA ============

-- Performance reviews
CREATE TYPE public.review_rating AS ENUM ('exceeds', 'meets', 'needs_improvement', 'unsatisfactory');

CREATE TABLE public.performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  reviewer_id UUID,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  overall_rating review_rating NOT NULL DEFAULT 'meets',
  productivity_score INT NOT NULL DEFAULT 0 CHECK (productivity_score BETWEEN 0 AND 100),
  quality_score INT NOT NULL DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 100),
  attendance_score INT NOT NULL DEFAULT 0 CHECK (attendance_score BETWEEN 0 AND 100),
  collaboration_score INT NOT NULL DEFAULT 0 CHECK (collaboration_score BETWEEN 0 AND 100),
  strengths TEXT,
  areas_to_improve TEXT,
  manager_notes TEXT,
  employee_acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own reviews" ON public.performance_reviews
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users acknowledge own reviews" ON public.performance_reviews
FOR UPDATE USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "managers/admins manage reviews" ON public.performance_reviews
FOR ALL USING (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'));

-- Payslips
CREATE TABLE public.payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year INT NOT NULL,
  base_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  bonus NUMERIC(12,2) NOT NULL DEFAULT 0,
  deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_pay NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  notes TEXT,
  issued_by UUID,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_year, period_month)
);

ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own payslips" ON public.payslips
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admins manage payslips" ON public.payslips
FOR ALL USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Deliverables (file submissions tied to tasks)
CREATE TYPE public.deliverable_status AS ENUM ('submitted', 'approved', 'rejected', 'revision_requested');

CREATE TABLE public.deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  mime_type TEXT,
  storage_path TEXT NOT NULL,
  description TEXT,
  status deliverable_status NOT NULL DEFAULT 'submitted',
  reviewer_id UUID,
  reviewer_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own deliverables" ON public.deliverables
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users create own deliverables" ON public.deliverables
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "managers/admins view all deliverables" ON public.deliverables
FOR SELECT USING (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "managers/admins review deliverables" ON public.deliverables
FOR UPDATE USING (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'));

-- Storage bucket for deliverables (private, 25MB cap enforced client-side)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('deliverables', 'deliverables', false, 26214400)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 26214400;

CREATE POLICY "users upload own deliverables" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'deliverables' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "users view own deliverable files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'deliverables' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "managers view all deliverable files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'deliverables' AND (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'))
);

CREATE POLICY "users delete own deliverable files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'deliverables' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Avatars bucket (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "anyone view avatars" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "users upload own avatar" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "users update own avatar" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add salary fields to profiles for payslip defaults
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS base_salary NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS hire_date DATE;
