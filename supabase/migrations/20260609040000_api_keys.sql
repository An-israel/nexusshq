-- Workspace-scoped API keys for the Public API.
-- Only the SHA-256 hash of the key is ever stored; the plaintext is returned
-- once at creation and never persisted.
CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,          -- SHA-256(plaintext_key) hex
  key_prefix   TEXT NOT NULL,                 -- first 12 chars for display
  scopes       TEXT[] NOT NULL DEFAULT '{}',  -- e.g. ARRAY['read:tasks','write:tasks']
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Workspace admins/owners can manage API keys for their workspace
CREATE POLICY "api_keys: workspace admins"
  ON api_keys
  FOR ALL
  USING  (is_workspace_admin(workspace_id))
  WITH CHECK (is_workspace_admin(workspace_id));
