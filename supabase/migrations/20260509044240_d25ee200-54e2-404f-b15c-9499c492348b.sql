
-- 1. Schedule auto clock-out at 17:00 WAT (16:00 UTC) every day
SELECT cron.unschedule('nexus-auto-clock-out') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname='nexus-auto-clock-out');

SELECT cron.schedule(
  'nexus-auto-clock-out',
  '0 16 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--1a191282-4857-4af0-8b72-38cc1bac2a29.lovable.app/api/public/cron/auto-clock-out',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- 2. Harden ensure_skryve_seed: revoke from authenticated, allow only service_role
REVOKE EXECUTE ON FUNCTION public.ensure_skryve_seed() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_skryve_seed() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_skryve_seed() FROM anon;
GRANT EXECUTE ON FUNCTION public.ensure_skryve_seed() TO service_role;

-- 3. Reset Opeyei's password to a temporary value
UPDATE auth.users
SET encrypted_password = crypt('Skryve2026!', gen_salt('bf')),
    updated_at = now()
WHERE id = 'ba66a01c-157f-4e02-ba1a-dfda106343c3';
