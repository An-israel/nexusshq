-- The billing page displays "Basic / Enterprise / Unlimited" pricing tiers,
-- but the workspace_plan enum only had the older starter/growth/business/
-- enterprise values. Add the tiers actually sold so a successful Paystack
-- charge can set workspaces.plan / subscriptions.plan to a valid value.
-- (Enum additions can't run in the same transaction as their first use, so
-- this stays isolated in its own migration.)
ALTER TYPE public.workspace_plan ADD VALUE IF NOT EXISTS 'basic';
ALTER TYPE public.workspace_plan ADD VALUE IF NOT EXISTS 'unlimited';

-- Track the Paystack transaction reference and billing cadence on each
-- subscription so the webhook can reconcile charges and the UI can show
-- whether the workspace is on monthly or annual billing.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS paystack_reference text,
  ADD COLUMN IF NOT EXISTS billing_interval text NOT NULL DEFAULT 'monthly'
    CHECK (billing_interval IN ('monthly', 'annual'));
