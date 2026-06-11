
-- 1. Extend notification_type enum with 'announcement'
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'announcement';

-- 2. invoices
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  paystack_reference text,
  invoice_number text NOT NULL UNIQUE,
  plan text NOT NULL,
  billing_interval text NOT NULL,
  amount_ngn integer NOT NULL DEFAULT 0,
  vat_ngn integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'paid',
  period_start timestamptz,
  period_end timestamptz,
  customer_email text,
  customer_name text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members can view invoices"
  ON public.invoices FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE INDEX IF NOT EXISTS invoices_workspace_idx ON public.invoices(workspace_id, issued_at DESC);

-- 3. api_keys
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  last_used_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
-- No public policies — admin actions go through server routes with service role.

-- 4. audit_events
CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members can view audit events"
  ON public.audit_events FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));
CREATE INDEX IF NOT EXISTS audit_events_workspace_idx ON public.audit_events(workspace_id, created_at DESC);

-- 5. user_sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  device_name text,
  user_agent text,
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, session_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own sessions"
  ON public.user_sessions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. push_subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own push subs"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. webhook_endpoints
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  secret text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_fired_at timestamptz,
  last_error text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.webhook_endpoints TO authenticated;
GRANT ALL ON public.webhook_endpoints TO service_role;
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Workspace members can view webhooks"
  ON public.webhook_endpoints FOR SELECT TO authenticated
  USING (public.is_workspace_member(workspace_id, auth.uid()));

-- 8. log_audit_event RPC
CREATE OR REPLACE FUNCTION public.log_audit_event(
  _workspace_id uuid,
  _action text,
  _target_type text DEFAULT NULL,
  _target_id text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_workspace_member(_workspace_id, auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  INSERT INTO public.audit_events (workspace_id, actor_id, action, target_type, target_id, metadata)
  VALUES (_workspace_id, auth.uid(), _action, _target_type, _target_id, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_audit_event(uuid, text, text, text, jsonb) TO authenticated;
