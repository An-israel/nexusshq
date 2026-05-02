-- Schedule auto clock-out at 16:00 UTC (= 17:00 WAT) every day.
-- Anyone still clocked in at that time is automatically clocked out.
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
