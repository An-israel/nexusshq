-- ============================================================
-- Automation Engine: automation_logs + automation_settings
-- ============================================================

-- ── 1. automation_logs ──────────────────────────────────────

create table if not exists automation_logs (
  id               uuid        primary key default gen_random_uuid(),
  workspace_id     uuid        references workspaces(id) on delete cascade,
  automation_type  text        not null,
  triggered_for    uuid        references profiles(id) on delete set null,
  details          jsonb       not null default '{}',
  status           text        not null check (status in ('success', 'failed', 'skipped')),
  ran_at           timestamptz not null default now()
);

alter table automation_logs enable row level security;

-- Admins and managers in the workspace can read logs
create policy "admins and managers read automation logs"
  on automation_logs for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = automation_logs.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin', 'manager')
    )
  );

-- Service role only for writes
create policy "service role insert automation logs"
  on automation_logs for insert
  with check (auth.role() = 'service_role');

create policy "service role update automation logs"
  on automation_logs for update
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create policy "service role delete automation logs"
  on automation_logs for delete
  using (auth.role() = 'service_role');

create index if not exists automation_logs_workspace_ran_at
  on automation_logs(workspace_id, ran_at desc);

create index if not exists automation_logs_workspace_type
  on automation_logs(workspace_id, automation_type);

-- ── 2. automation_settings ──────────────────────────────────

create table if not exists automation_settings (
  workspace_id                  uuid        primary key references workspaces(id) on delete cascade,
  task_reminders_enabled        boolean     not null default true,
  auto_status_enabled           boolean     not null default true,
  overdue_escalation_enabled    boolean     not null default true,
  scheduled_reports_enabled     boolean     not null default true,
  clock_reminders_enabled       boolean     not null default true,
  auto_clockout_enabled         boolean     not null default true,
  daily_report_time             time        not null default '17:30',
  weekly_report_day             text        not null default 'monday',
  report_recipients             text[]               default array[]::text[],
  updated_at                    timestamptz not null default now()
);

alter table automation_settings enable row level security;

-- Admins can read their workspace's settings
create policy "admins read automation settings"
  on automation_settings for select
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = automation_settings.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- Admins can update their workspace's settings
create policy "admins update automation settings"
  on automation_settings for update
  using (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = automation_settings.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from workspace_members wm
      where wm.workspace_id = automation_settings.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- Service role full access
create policy "service role all automation settings"
  on automation_settings for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ── 3. Seed default settings for all existing workspaces ────

insert into automation_settings (workspace_id)
select id from workspaces
on conflict (workspace_id) do nothing;

-- ── 4. Cron schedules (pg_cron + pg_net) ────────────────────
--
-- Schedule reference (all times UTC, WAT = UTC+1):
--   Task reminder engine       : 0 7 * * 1-5    (07:00 UTC weekdays)
--   Auto status engine         : 1 0 * * *       (00:01 UTC daily)
--   Overdue escalation         : 0 9 * * 1-5    (09:00 UTC weekdays)
--   Scheduled reports daily    : 30 16 * * 1-5   (16:30 UTC weekdays)
--   Scheduled reports weekly   : 0 6 * * 1       (06:00 UTC Monday)
--   Scheduled reports monthly  : 0 6 1 * *       (06:00 UTC 1st of month)
--   Clock reminder 08:15 UTC   : 15 8 * * 1-5    (08:15 UTC weekdays)
--   Clock reminder 08:30 UTC   : 30 8 * * 1-5    (08:30 UTC weekdays)
--   Clock reminder 15:15 UTC   : 15 15 * * 1-5   (15:15 UTC weekdays)
--   Auto clockout 16:00 UTC    : 0 16 * * 1-5    (16:00 UTC weekdays)
--
-- To run manually:
--   SELECT cron.schedule('nexus-task-reminder-engine', '0 7 * * 1-5', ...);
--   SELECT cron.unschedule('nexus-task-reminder-engine');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN

    -- Task reminder engine: 07:00 UTC weekdays (08:00 WAT)
    PERFORM cron.schedule(
      'nexus-task-reminder-engine',
      '0 7 * * 1-5',
      format(
        $cron$
        SELECT net.http_post(
          url := %L || '/functions/v1/task-reminder-engine',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
          ),
          body := '{}'::jsonb
        );
        $cron$,
        current_setting('app.supabase_url', true)
      )
    );

    -- Auto status engine: 00:01 UTC daily
    PERFORM cron.schedule(
      'nexus-auto-status-engine',
      '1 0 * * *',
      format(
        $cron$
        SELECT net.http_post(
          url := %L || '/functions/v1/auto-status-engine',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
          ),
          body := '{}'::jsonb
        );
        $cron$,
        current_setting('app.supabase_url', true)
      )
    );

    -- Overdue escalation: 09:00 UTC weekdays (10:00 WAT)
    PERFORM cron.schedule(
      'nexus-overdue-escalation',
      '0 9 * * 1-5',
      format(
        $cron$
        SELECT net.http_post(
          url := %L || '/functions/v1/overdue-escalation',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
          ),
          body := '{}'::jsonb
        );
        $cron$,
        current_setting('app.supabase_url', true)
      )
    );

    -- Scheduled reports daily: 16:30 UTC weekdays (17:30 WAT)
    PERFORM cron.schedule(
      'nexus-scheduled-reports-daily',
      '30 16 * * 1-5',
      format(
        $cron$
        SELECT net.http_post(
          url := %L || '/functions/v1/scheduled-reports',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
          ),
          body := '{"report_type":"daily"}'::jsonb
        );
        $cron$,
        current_setting('app.supabase_url', true)
      )
    );

    -- Scheduled reports weekly: 06:00 UTC Monday (07:00 WAT)
    PERFORM cron.schedule(
      'nexus-scheduled-reports-weekly',
      '0 6 * * 1',
      format(
        $cron$
        SELECT net.http_post(
          url := %L || '/functions/v1/scheduled-reports',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
          ),
          body := '{"report_type":"weekly"}'::jsonb
        );
        $cron$,
        current_setting('app.supabase_url', true)
      )
    );

    -- Scheduled reports monthly: 06:00 UTC 1st of month (07:00 WAT)
    PERFORM cron.schedule(
      'nexus-scheduled-reports-monthly',
      '0 6 1 * *',
      format(
        $cron$
        SELECT net.http_post(
          url := %L || '/functions/v1/scheduled-reports',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
          ),
          body := '{"report_type":"monthly"}'::jsonb
        );
        $cron$,
        current_setting('app.supabase_url', true)
      )
    );

    -- Clock reminder 08:15 UTC weekdays
    PERFORM cron.schedule(
      'nexus-clock-reminder-0815',
      '15 8 * * 1-5',
      format(
        $cron$
        SELECT net.http_post(
          url := %L || '/functions/v1/clock-reminder-engine',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
          ),
          body := '{"window":"morning_first"}'::jsonb
        );
        $cron$,
        current_setting('app.supabase_url', true)
      )
    );

    -- Clock reminder 08:30 UTC weekdays
    PERFORM cron.schedule(
      'nexus-clock-reminder-0830',
      '30 8 * * 1-5',
      format(
        $cron$
        SELECT net.http_post(
          url := %L || '/functions/v1/clock-reminder-engine',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
          ),
          body := '{"window":"morning_second"}'::jsonb
        );
        $cron$,
        current_setting('app.supabase_url', true)
      )
    );

    -- Clock reminder 15:15 UTC weekdays
    PERFORM cron.schedule(
      'nexus-clock-reminder-1515',
      '15 15 * * 1-5',
      format(
        $cron$
        SELECT net.http_post(
          url := %L || '/functions/v1/clock-reminder-engine',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
          ),
          body := '{"window":"afternoon"}'::jsonb
        );
        $cron$,
        current_setting('app.supabase_url', true)
      )
    );

    -- Auto clockout 16:00 UTC weekdays
    PERFORM cron.schedule(
      'nexus-auto-clockout-engine',
      '0 16 * * 1-5',
      format(
        $cron$
        SELECT net.http_post(
          url := %L || '/functions/v1/auto-clockout-engine',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
          ),
          body := '{}'::jsonb
        );
        $cron$,
        current_setting('app.supabase_url', true)
      )
    );

  END IF;
END;
$$;
