-- Schedule the cron jobs that exist as route handlers but were never wired
-- up via cron.schedule(): notification-email, late-task-report,
-- weekly-summary-email, and the transactional email queue processor.
--
-- All jobs send the project's service-role key as a Bearer token, following
-- the same convention established in 20260608160000_cron_endpoint_auth.sql.

SELECT cron.unschedule('nexus-notification-email')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nexus-notification-email');

SELECT cron.schedule(
  'nexus-notification-email',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--1a191282-4857-4af0-8b72-38cc1bac2a29.lovable.app/api/public/cron/notification-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.unschedule('nexus-late-task-report')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nexus-late-task-report');

SELECT cron.schedule(
  'nexus-late-task-report',
  '0 7 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://project--1a191282-4857-4af0-8b72-38cc1bac2a29.lovable.app/api/public/cron/late-task-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.unschedule('nexus-weekly-summary-email')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nexus-weekly-summary-email');

SELECT cron.schedule(
  'nexus-weekly-summary-email',
  '0 6 * * 1',
  $$
  SELECT net.http_post(
    url := 'https://project--1a191282-4857-4af0-8b72-38cc1bac2a29.lovable.app/api/public/cron/weekly-summary-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.unschedule('nexus-email-queue-process')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nexus-email-queue-process');

SELECT cron.schedule(
  'nexus-email-queue-process',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--1a191282-4857-4af0-8b72-38cc1bac2a29.lovable.app/lovable/email/queue/process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
