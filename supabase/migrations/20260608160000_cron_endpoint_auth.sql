-- Require pg_cron callers to authenticate to /api/public/cron/* endpoints.
--
-- These endpoints were previously reachable by anyone on the internet with
-- no credentials at all — a real exploitable gap given they trigger bulk
-- email sends (message-email, weekly-summary-email), costly AI calls
-- (burnout-detection), and mutate attendance records (auto-clock-out,
-- clock-reminder).
--
-- Fix: send the project's service-role key as a bearer token — the same
-- `current_setting('app.service_role_key', true)` convention already
-- established by the automation-engine cron jobs for calling edge functions
-- (see 20260518000000_automation_engine.sql). The route handlers verify this
-- token against SUPABASE_SERVICE_ROLE_KEY with a constant-time comparison
-- (src/server/cron-auth.server.ts) before doing any work, returning 401
-- otherwise. Reusing this existing setting means no new secret needs to be
-- generated or distributed out-of-band.
--
-- Re-create the 3 jobs that are actually scheduled today so they send the
-- Authorization header. (late-task-report / burnout-detection /
-- weekly-summary-email are documented for manual scheduling in their own
-- migrations and were never cron.schedule()'d here — there's no job
-- definition to update for them, but their handlers are hardened too.)

SELECT cron.unschedule('nexus-clock-out-reminder')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nexus-clock-out-reminder');

SELECT cron.schedule(
  'nexus-clock-out-reminder',
  '15 15 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://project--1a191282-4857-4af0-8b72-38cc1bac2a29.lovable.app/api/public/cron/clock-reminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.unschedule('nexus-auto-clock-out')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nexus-auto-clock-out');

SELECT cron.schedule(
  'nexus-auto-clock-out',
  '0 16 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--1a191282-4857-4af0-8b72-38cc1bac2a29.lovable.app/api/public/cron/auto-clock-out',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.unschedule('nexus-message-email-notify')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nexus-message-email-notify');

SELECT cron.schedule(
  'nexus-message-email-notify',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--1a191282-4857-4af0-8b72-38cc1bac2a29.lovable.app/api/public/cron/message-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
