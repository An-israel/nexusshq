-- Update handle_new_user to auto-grant admin to known admin emails
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  is_admin_email boolean := lower(coalesce(new.email,'')) in ('skryveai@gmail.com','aniekaneazy@gmail.com');
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, case when is_admin_email then 'admin'::app_role else 'employee'::app_role end)
  on conflict (user_id, role) do nothing;

  return new;
end;
$function$;

-- Backfill: grant admin to these emails if they already exist
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::app_role
FROM auth.users u
WHERE lower(u.email) IN ('skryveai@gmail.com','aniekaneazy@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

-- Make sure the trigger exists on auth.users (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();