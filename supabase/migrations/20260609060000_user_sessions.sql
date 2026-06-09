-- Per-device session tracking for the "Active sessions" panel.
-- A stable session_id UUID is generated client-side per device (localStorage)
-- and upserted on every workspace shell mount.
CREATE TABLE IF NOT EXISTS user_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id     TEXT NOT NULL,                -- client-generated device UUID
  user_agent     TEXT,
  device_name    TEXT,                         -- simplified label, e.g. "Chrome on macOS"
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, session_id)
);

ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own sessions
CREATE POLICY "user_sessions: own rows"
  ON user_sessions
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-prune sessions older than 90 days (keep table tidy)
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_active
  ON user_sessions (user_id, last_active_at DESC);
