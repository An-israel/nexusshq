-- Create super_admin_users table if it doesn't exist.
-- Super-admins are platform-level administrators who can manage all workspaces.
-- Rows are inserted manually via the Supabase SQL editor (service role).

CREATE TABLE IF NOT EXISTS public.super_admin_users (
  user_id    uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.super_admin_users ENABLE ROW LEVEL SECURITY;

-- Allow each user to check whether they are a super admin.
-- Super admins insert their own row via the SQL editor (service role bypasses RLS).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'super_admin_users'
      AND policyname = 'super_admin_self_select'
  ) THEN
    CREATE POLICY super_admin_self_select
      ON public.super_admin_users
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;
