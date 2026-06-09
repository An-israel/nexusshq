-- Invoice records created on each successful Paystack charge.
-- Stores subtotal + VAT (7.5% Nigerian VAT, inclusive of the charged amount).
CREATE TABLE IF NOT EXISTS invoices (
  id                  uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id        uuid          NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subscription_id     uuid          REFERENCES subscriptions(id) ON DELETE SET NULL,
  paystack_reference  text,
  invoice_number      text          UNIQUE NOT NULL,
  plan                text          NOT NULL,
  billing_interval    text          NOT NULL DEFAULT 'monthly',
  amount_ngn          integer       NOT NULL,   -- total charged (VAT-inclusive)
  vat_ngn             integer       NOT NULL DEFAULT 0,
  status              text          NOT NULL DEFAULT 'paid'
                                    CHECK (status IN ('paid', 'void')),
  period_start        timestamptz,
  period_end          timestamptz,
  issued_at           timestamptz   DEFAULT now(),
  customer_email      text,
  customer_name       text
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Workspace admins and managers can read invoices for their workspace.
CREATE POLICY "workspace_admins_view_invoices" ON invoices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      JOIN user_roles ur ON ur.user_id = wm.user_id
      WHERE wm.workspace_id = invoices.workspace_id
        AND wm.user_id      = auth.uid()
        AND ur.role         IN ('admin', 'manager')
    )
  );
