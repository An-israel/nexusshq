
ALTER TABLE public.standups ADD COLUMN IF NOT EXISTS screenshot_url text;

CREATE TABLE IF NOT EXISTS public.standup_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standup_id uuid NOT NULL REFERENCES public.standups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  body text NOT NULL,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.standup_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth view standup comments" ON public.standup_comments;
CREATE POLICY "auth view standup comments" ON public.standup_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "users insert own standup comments" ON public.standup_comments;
CREATE POLICY "users insert own standup comments" ON public.standup_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "users delete own standup comments" ON public.standup_comments;
CREATE POLICY "users delete own standup comments" ON public.standup_comments FOR DELETE TO authenticated USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS autofill_workspace_id_trg ON public.standup_comments;
CREATE TRIGGER autofill_workspace_id_trg BEFORE INSERT ON public.standup_comments
  FOR EACH ROW EXECUTE FUNCTION public.autofill_workspace_id();

INSERT INTO storage.buckets (id, name, public) VALUES ('standup-screenshots','standup-screenshots', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "standup screenshots public read" ON storage.objects;
CREATE POLICY "standup screenshots public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'standup-screenshots');
DROP POLICY IF EXISTS "standup screenshots auth upload" ON storage.objects;
CREATE POLICY "standup screenshots auth upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'standup-screenshots');
DROP POLICY IF EXISTS "standup screenshots auth update" ON storage.objects;
CREATE POLICY "standup screenshots auth update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'standup-screenshots');
