-- Slack-like messages: group avatar, message edit/delete, storage policies

ALTER TABLE public.message_groups ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE public.group_messages  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- RLS: own-message edit & delete, group-creator avatar update
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='direct_messages' AND policyname='users update own dms') THEN
    CREATE POLICY "users update own dms" ON public.direct_messages
      FOR UPDATE USING (auth.uid() = from_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='direct_messages' AND policyname='users delete own dms') THEN
    CREATE POLICY "users delete own dms" ON public.direct_messages
      FOR DELETE USING (auth.uid() = from_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_messages' AND policyname='users update own group messages') THEN
    CREATE POLICY "users update own group messages" ON public.group_messages
      FOR UPDATE USING (auth.uid() = from_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_messages' AND policyname='users delete own group messages') THEN
    CREATE POLICY "users delete own group messages" ON public.group_messages
      FOR DELETE USING (auth.uid() = from_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='message_groups' AND policyname='creator updates group') THEN
    CREATE POLICY "creator updates group" ON public.message_groups
      FOR UPDATE USING (auth.uid() = created_by);
  END IF;
END $$;

-- Ensure avatars bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 'avatars', true, 2097152,
  ARRAY['image/jpeg','image/png','image/gif','image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars public read') THEN
    CREATE POLICY "avatars public read" ON storage.objects
      FOR SELECT USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars authenticated upload') THEN
    CREATE POLICY "avatars authenticated upload" ON storage.objects
      FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars authenticated update') THEN
    CREATE POLICY "avatars authenticated update" ON storage.objects
      FOR UPDATE TO authenticated USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='avatars authenticated delete') THEN
    CREATE POLICY "avatars authenticated delete" ON storage.objects
      FOR DELETE TO authenticated USING (bucket_id = 'avatars');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
