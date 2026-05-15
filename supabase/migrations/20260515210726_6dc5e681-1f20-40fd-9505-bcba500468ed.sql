
CREATE TABLE public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  mentions_enabled BOOLEAN NOT NULL DEFAULT true,
  pins_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_id)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notif prefs"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own notif prefs"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own notif prefs"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own notif prefs"
  ON public.notification_preferences FOR DELETE
  USING (auth.uid() = user_id);

-- Allow notify functions to read recipients' prefs (workspace members can see each other's prefs in the same workspace)
CREATE POLICY "Workspace members can read prefs in their workspace"
  ON public.notification_preferences FOR SELECT
  USING (public.is_workspace_member(workspace_id, auth.uid()));
