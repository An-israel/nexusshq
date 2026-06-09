-- Outbound webhook endpoints registered per workspace.
-- When a subscribed event fires, the server POSTs a signed JSON payload to the URL.
CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  url          TEXT NOT NULL,
  events       TEXT[] NOT NULL DEFAULT '{}',   -- e.g. ARRAY['task.created','standup.submitted']
  secret       TEXT NOT NULL,                  -- HMAC-SHA256 signing secret (stored, not hashed)
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_fired_at TIMESTAMPTZ,
  last_error   TEXT
);

ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_endpoints: workspace admins"
  ON webhook_endpoints
  FOR ALL
  USING  (is_workspace_admin(workspace_id))
  WITH CHECK (is_workspace_admin(workspace_id));
