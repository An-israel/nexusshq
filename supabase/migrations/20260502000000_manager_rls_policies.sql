-- Allow managers to manage (delete + insert) user_roles for non-admin roles,
-- using their own JWT instead of service-role key.

-- Managers can remove any role assignment (needed to swap roles atomically)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_roles' AND policyname = 'managers delete roles'
  ) THEN
    CREATE POLICY "managers delete roles" ON public.user_roles
      FOR DELETE USING (
        public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin')
      );
  END IF;
END $$;

-- Managers can assign employee/manager roles; only admins can assign admin
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_roles' AND policyname = 'managers insert non-admin roles'
  ) THEN
    CREATE POLICY "managers insert non-admin roles" ON public.user_roles
      FOR INSERT WITH CHECK (
        public.has_role(auth.uid(), 'admin')
        OR (
          public.has_role(auth.uid(), 'manager')
          AND role != 'admin'::public.app_role
        )
      );
  END IF;
END $$;

-- Managers can update is_active on employee profiles
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'managers update employee profiles'
  ) THEN
    CREATE POLICY "managers update employee profiles" ON public.profiles
      FOR UPDATE USING (
        public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin')
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
