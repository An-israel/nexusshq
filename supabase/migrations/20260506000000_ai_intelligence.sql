-- AI Intelligence Layer: burnout_alerts table
create table if not exists burnout_alerts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users not null,
  detected_at   timestamptz default now() not null,
  risk_level    text check (risk_level in ('low', 'medium', 'high')) not null,
  reason        text not null,
  acknowledged_at  timestamptz,
  acknowledged_by  uuid references auth.users
);

alter table burnout_alerts enable row level security;

-- Admins and managers can view all alerts
create policy "managers view burnout alerts"
  on burnout_alerts for select
  using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
        and role in ('admin', 'manager')
    )
  );

-- Employees can view their own alert
create policy "employees view own burnout alert"
  on burnout_alerts for select
  using (user_id = auth.uid());

-- Service role inserts (cron job uses supabaseAdmin)
create policy "service role inserts burnout alerts"
  on burnout_alerts for insert
  with check (true);

-- Managers can acknowledge (update) alerts
create policy "managers acknowledge burnout alerts"
  on burnout_alerts for update
  using (
    exists (
      select 1 from user_roles
      where user_id = auth.uid()
        and role in ('admin', 'manager')
    )
  );

-- Schedule burnout detection: every Sunday 06:00 UTC (= 07:00 WAT)
-- Run in Supabase SQL editor after deploying. Must include the bearer auth
-- header (see src/server/cron-auth.server.ts / 20260608160000_cron_endpoint_auth.sql):
-- SELECT cron.schedule(
--   'nexus-burnout-detection',
--   '0 6 * * 0',
--   $$ SELECT net.http_post(
--        url := 'https://<your-domain>/api/public/cron/burnout-detection',
--        headers := jsonb_build_object(
--          'Content-Type', 'application/json',
--          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
--        ),
--        body := '{}'::jsonb
--      ); $$
-- );

-- Schedule weekly summary email: every Monday 06:00 UTC (= 07:00 WAT)
-- SELECT cron.schedule(
--   'nexus-weekly-summary-email',
--   '0 6 * * 1',
--   $$ SELECT net.http_post(
--        url := 'https://<your-domain>/api/public/cron/weekly-summary-email',
--        headers := jsonb_build_object(
--          'Content-Type', 'application/json',
--          'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
--        ),
--        body := '{}'::jsonb
--      ); $$
-- );
