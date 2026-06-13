-- Re-point all pg_cron jobs from the Lovable preview domain
-- (project--1a191282-...lovable.app) to the real production domain. This
-- project is moving off Lovable hosting entirely.
--
-- If nexus.skryveai.com is not (or no longer) the production domain, update
-- the URLs below and re-run this migration (cron.schedule with an existing
-- jobname replaces the job in place).

SELECT cron.unschedule('nexus-clock-out-reminder')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nexus-clock-out-reminder');

SELECT cron.schedule(
  'nexus-clock-out-reminder',
  '15 15 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://nexus.skryveai.com/api/public/cron/clock-reminder',
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
    url := 'https://nexus.skryveai.com/api/public/cron/auto-clock-out',
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
    url := 'https://nexus.skryveai.com/api/public/cron/message-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.unschedule('nexus-notification-email')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nexus-notification-email');

SELECT cron.schedule(
  'nexus-notification-email',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://nexus.skryveai.com/api/public/cron/notification-email',
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
    url := 'https://nexus.skryveai.com/api/public/cron/late-task-report',
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
    url := 'https://nexus.skryveai.com/api/public/cron/weekly-summary-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

