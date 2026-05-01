DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['notifications','attendance','flags','deliverables']) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.attendance REPLICA IDENTITY FULL;
ALTER TABLE public.flags REPLICA IDENTITY FULL;
ALTER TABLE public.deliverables REPLICA IDENTITY FULL;