CREATE TABLE IF NOT EXISTS public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_flags readable by authenticated"
  ON public.feature_flags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "feature_flags admins insert"
  ON public.feature_flags FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "feature_flags admins update"
  ON public.feature_flags FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "feature_flags admins delete"
  ON public.feature_flags FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.feature_flags;