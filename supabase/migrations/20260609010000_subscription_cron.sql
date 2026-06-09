-- Schedule a daily subscription-expiry check (dunning).
-- The service-role key is read from a Postgres setting set out-of-band
-- (same convention as nexus-clock-out-reminder and other jobs).
-- Run this in the Supabase SQL editor AFTER setting app.service_role_key.
SELECT cron.schedule(
  'nexus-subscription-check',
  '0 2 * * *',
  $$ SELECT net.http_post(
       url     := current_setting('app.app_url', true) || '/api/public/cron/subscription-check',
       headers := jsonb_build_object(
         'Content-Type',   'application/json',
         'Authorization',  'Bearer ' || current_setting('app.service_role_key', true)
       ),
       body    := '{}'::jsonb
     ); $$
);
