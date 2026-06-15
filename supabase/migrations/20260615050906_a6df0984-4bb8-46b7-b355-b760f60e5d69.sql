ALTER TABLE public.workspace_invitations
  ADD COLUMN IF NOT EXISTS email_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS email_error TEXT,
  ADD COLUMN IF NOT EXISTS email_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS email_last_attempt_at TIMESTAMPTZ;

ALTER TABLE public.workspace_invitations
  DROP CONSTRAINT IF EXISTS workspace_invitations_email_status_check;
ALTER TABLE public.workspace_invitations
  ADD CONSTRAINT workspace_invitations_email_status_check
  CHECK (email_status IN ('pending', 'sent', 'failed'));

COMMENT ON COLUMN public.workspace_invitations.email_status IS 'Delivery status of the invite email (pending, sent, failed)';