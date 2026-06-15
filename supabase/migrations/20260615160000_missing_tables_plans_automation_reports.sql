-- Three migrations that were never applied to the live database, found via
-- a table-existence audit (information_schema.tables) against the migration
-- history:
--
-- 1. public.plans (20260507000000_multi_tenancy.sql) — referenced by the
--    super-admin "Plans" tab (src/routes/super-admin.tsx). Also fixes two
--    latent bugs in that table's original definition that would have broken
--    "Initialize default plans" even once created:
--      - price_ngn/price_usd/max_seats were NOT NULL, but DEFAULT_PLANS
--        sends null for the starter/enterprise tiers ("custom pricing").
--      - no UNIQUE constraint on `name`, but the upsert uses
--        onConflict: "name".
--
-- 2. automation_logs + automation_settings (20260518000000_automation_engine.sql)
--    — used by src/routes/_app.$workspaceSlug.settings.automations.tsx
--    (admin-only automation configuration page), which was 404ing on every
--    query.
--
-- 3. public.report_exports (20260518100000_report_exports.sql) — also fixes
--    the same "owner excluded from admin checks" bug as the documents/
--    invoices migration (was wm.role in ('admin','manager'), now
--    is_workspace_manager so owners/admins/managers can all view+create
--    exports).

-- ── 1. plans ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  price_ngn   integer,
  price_usd   integer,
  max_seats   integer,
  features    jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ALTER COLUMN price_ngn DROP NOT NULL;
ALTER TABLE public.plans ALTER COLUMN price_ngn DROP DEFAULT;
ALTER TABLE public.plans ALTER COLUMN price_usd DROP NOT NULL;
ALTER TABLE public.plans ALTER COLUMN price_usd DROP DEFAULT;
ALTER TABLE public.plans ALTER COLUMN max_seats DROP NOT NULL;
ALTER TABLE public.plans ALTER COLUMN max_seats DROP DEFAULT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plans_name_key'
  ) THEN
    ALTER TABLE public.plans ADD CONSTRAINT plans_name_key UNIQUE (name);
  END IF;
END $$;

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plans readable by authenticated" ON public.plans;
CREATE POLICY "plans readable by authenticated"
  ON public.plans FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "super admins manage plans" ON public.plans;
CREATE POLICY "super admins manage plans"
  ON public.plans FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

INSERT INTO public.plans (name, price_ngn, price_usd, max_seats, features) VALUES
  ('starter', NULL, NULL, 5, '["Attendance tracking","Task management","Direct messages","Org chart","Company handbook"]'),
  ('growth', 49000, 49, 25, '["Everything in Starter","AI intelligence","KPIs & OKRs","Reports & analytics","Client portal"]'),
  ('business', 120000, 120, 100, '["Everything in Growth","Custom branding","SSO / SAML","Dedicated onboarding","SLA guarantee"]'),
  ('enterprise', NULL, NULL, NULL, '["Everything in Business","On-premise option","Custom integrations","Audit logs","24/7 support"]')
ON CONFLICT (name) DO NOTHING;

-- ── 2. automation_logs + automation_settings ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.automation_logs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid        REFERENCES public.workspaces(id) ON DELETE CASCADE,
  automation_type  text        NOT NULL,
  triggered_for    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  details          jsonb       NOT NULL DEFAULT '{}',
  status           text        NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  ran_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins and managers read automation logs" ON public.automation_logs;
CREATE POLICY "admins and managers read automation logs"
  ON public.automation_logs FOR SELECT
  USING (public.is_workspace_manager(automation_logs.workspace_id, auth.uid()));

DROP POLICY IF EXISTS "service role insert automation logs" ON public.automation_logs;
CREATE POLICY "service role insert automation logs"
  ON public.automation_logs FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service role update automation logs" ON public.automation_logs;
CREATE POLICY "service role update automation logs"
  ON public.automation_logs FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service role delete automation logs" ON public.automation_logs;
CREATE POLICY "service role delete automation logs"
  ON public.automation_logs FOR DELETE
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS automation_logs_workspace_ran_at
  ON public.automation_logs(workspace_id, ran_at DESC);

CREATE INDEX IF NOT EXISTS automation_logs_workspace_type
  ON public.automation_logs(workspace_id, automation_type);

CREATE TABLE IF NOT EXISTS public.automation_settings (
  workspace_id                  uuid        PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  task_reminders_enabled        boolean     NOT NULL DEFAULT true,
  auto_status_enabled           boolean     NOT NULL DEFAULT true,
  overdue_escalation_enabled    boolean     NOT NULL DEFAULT true,
  scheduled_reports_enabled     boolean     NOT NULL DEFAULT true,
  clock_reminders_enabled       boolean     NOT NULL DEFAULT true,
  auto_clockout_enabled         boolean     NOT NULL DEFAULT true,
  daily_report_time             time        NOT NULL DEFAULT '17:30',
  weekly_report_day             text        NOT NULL DEFAULT 'monday',
  report_recipients             text[]               DEFAULT ARRAY[]::text[],
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read automation settings" ON public.automation_settings;
CREATE POLICY "admins read automation settings"
  ON public.automation_settings FOR SELECT
  USING (public.is_workspace_admin(automation_settings.workspace_id, auth.uid()));

DROP POLICY IF EXISTS "admins update automation settings" ON public.automation_settings;
CREATE POLICY "admins update automation settings"
  ON public.automation_settings FOR UPDATE
  USING (public.is_workspace_admin(automation_settings.workspace_id, auth.uid()))
  WITH CHECK (public.is_workspace_admin(automation_settings.workspace_id, auth.uid()));

DROP POLICY IF EXISTS "service role all automation settings" ON public.automation_settings;
CREATE POLICY "service role all automation settings"
  ON public.automation_settings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO public.automation_settings (workspace_id)
SELECT id FROM public.workspaces
ON CONFLICT (workspace_id) DO NOTHING;

-- ── 3. report_exports ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.report_exports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  export_type   text NOT NULL CHECK (export_type IN ('csv', 'pdf')),
  period_label  text NOT NULL,
  generated_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  generated_at  timestamptz NOT NULL DEFAULT now(),
  filters       jsonb DEFAULT '{}'
);

ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace members view exports" ON public.report_exports;
CREATE POLICY "workspace members view exports"
  ON public.report_exports FOR SELECT
  USING (public.is_workspace_manager(report_exports.workspace_id, auth.uid()));

DROP POLICY IF EXISTS "workspace members insert exports" ON public.report_exports;
CREATE POLICY "workspace members insert exports"
  ON public.report_exports FOR INSERT
  WITH CHECK (public.is_workspace_manager(report_exports.workspace_id, auth.uid()));

CREATE INDEX IF NOT EXISTS report_exports_workspace_idx
  ON public.report_exports(workspace_id, generated_at DESC);

-- ── 4. Realtime publication gaps ───────────────────────────────────────────
-- These tables have client-side postgres_changes subscriptions
-- (use-live-data.ts task_updates feed, super-admin live workspace_members
-- and workspace_invites views) but were never added to supabase_realtime,
-- so those subscriptions silently never fire.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.task_updates;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_invites;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

