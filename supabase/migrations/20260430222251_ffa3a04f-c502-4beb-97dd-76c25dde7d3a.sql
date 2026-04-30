CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'nexus-clock-out-reminder',
  '15 15 * * 1-5',
  $$
  SELECT net.http_post(
    url := 'https://project--1a191282-4857-4af0-8b72-38cc1bac2a29.lovable.app/api/public/cron/clock-reminder',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);