ALTER TABLE public.message_groups ADD COLUMN IF NOT EXISTS avatar_url text;

DROP POLICY IF EXISTS "creators update own groups" ON public.message_groups;
CREATE POLICY "creators update own groups" ON public.message_groups
  FOR UPDATE USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "auth upload group avatars" ON storage.objects;
CREATE POLICY "auth upload group avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'groups');

DROP POLICY IF EXISTS "auth update group avatars" ON storage.objects;
CREATE POLICY "auth update group avatars" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'groups');

DROP POLICY IF EXISTS "members add members" ON public.message_group_members;
CREATE POLICY "members add members" ON public.message_group_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR public.is_group_member(group_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.message_groups WHERE id = group_id AND created_by = auth.uid())
  );

DROP POLICY IF EXISTS "leave or creator removes" ON public.message_group_members;
CREATE POLICY "leave or creator removes" ON public.message_group_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.message_groups WHERE id = group_id AND created_by = auth.uid())
  );

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='notification_type' AND e.enumlabel='mention') THEN
    ALTER TYPE public.notification_type ADD VALUE 'mention';
  END IF;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;