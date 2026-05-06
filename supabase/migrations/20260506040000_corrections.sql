-- ── 1. Monthly task type ────────────────────────────────────────────────────
ALTER TYPE public.task_type ADD VALUE IF NOT EXISTS 'monthly';

-- ── 2. Standup screenshot + comments ────────────────────────────────────────
ALTER TABLE public.standups
  ADD COLUMN IF NOT EXISTS screenshot_url text;

CREATE TABLE IF NOT EXISTS public.standup_comments (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  standup_id uuid        NOT NULL REFERENCES public.standups(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       text        NOT NULL CHECK (char_length(body) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.standup_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read standup comments"
  ON public.standup_comments FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated insert own comment"
  ON public.standup_comments FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "own delete standup comment"
  ON public.standup_comments FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ── 3. Message file attachments ──────────────────────────────────────────────
ALTER TABLE public.direct_messages
  ADD COLUMN IF NOT EXISTS attachment_url  text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_mime text;

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS attachment_url  text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_mime text;

-- ── 4. message-attachments storage bucket (public, unguessable paths) ───────
INSERT INTO storage.buckets (id, name, public, file_size_limit)
  VALUES ('message-attachments', 'message-attachments', true, 26214400)
  ON CONFLICT (id) DO NOTHING;

-- Storage bucket for standup screenshots (public so we can display inline)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('standup-screenshots', 'standup-screenshots', true, 10485760,
          ARRAY['image/jpeg','image/png','image/webp','image/gif'])
  ON CONFLICT (id) DO NOTHING;

-- RLS for message-attachments
CREATE POLICY "users upload own attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'message-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "authenticated users read attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'message-attachments');

-- RLS for standup-screenshots
CREATE POLICY "users upload own screenshots"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'standup-screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "public read screenshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'standup-screenshots');
