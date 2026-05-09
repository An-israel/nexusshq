-- ============================================================
-- MESSAGING V2: Slack-like channel + DM system for Nexus HQ
-- ============================================================

-- ── 1. NEW TABLES ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.channels (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  type         text NOT NULL DEFAULT 'public'
               CHECK (type IN ('public','private','announcement')),
  created_by   uuid REFERENCES public.profiles(id),
  is_default   boolean NOT NULL DEFAULT false,
  is_archived  boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, name)
);

CREATE TABLE IF NOT EXISTS public.channel_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id   uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'member' CHECK (role IN ('admin','member')),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  is_muted     boolean NOT NULL DEFAULT false,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.dm_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  type            text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct','group')),
  name            text,
  created_by      uuid REFERENCES public.profiles(id),
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dm_members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at    timestamptz NOT NULL DEFAULT now(),
  is_muted        boolean NOT NULL DEFAULT false,
  UNIQUE(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel_id           uuid REFERENCES public.channels(id) ON DELETE CASCADE,
  conversation_id      uuid REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  sender_id            uuid NOT NULL REFERENCES public.profiles(id),
  body                 text NOT NULL,
  body_html            text,
  parent_message_id    uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  thread_reply_count   integer NOT NULL DEFAULT 0,
  thread_last_reply_at timestamptz,
  is_edited            boolean NOT NULL DEFAULT false,
  edited_at            timestamptz,
  is_deleted           boolean NOT NULL DEFAULT false,
  pinned               boolean NOT NULL DEFAULT false,
  pinned_by            uuid REFERENCES public.profiles(id),
  has_attachment       boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_target_check CHECK (
    (channel_id IS NOT NULL AND conversation_id IS NULL) OR
    (channel_id IS NULL AND conversation_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id            uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  file_name             text NOT NULL,
  file_type             text NOT NULL DEFAULT '',
  file_size_bytes       bigint NOT NULL DEFAULT 0,
  google_drive_file_id  text,
  google_drive_view_url text,
  storage_path          text,
  thumbnail_url         text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id      uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.workspaces(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'offline'
               CHECK (status IN ('active','away','dnd','offline')),
  status_emoji text,
  status_text  text,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

-- ── 2. SEED DEFAULT CHANNELS FOR EXISTING WORKSPACES ────────

DO $$
DECLARE
  ws       RECORD;
  owner_id uuid;
  ch_id    uuid;
BEGIN
  FOR ws IN SELECT id FROM public.workspaces WHERE is_active = true LOOP

    -- Find the workspace owner/admin to set as channel creator
    SELECT user_id INTO owner_id
    FROM public.workspace_members
    WHERE workspace_id = ws.id AND role IN ('owner','admin')
    LIMIT 1;

    -- #general
    INSERT INTO public.channels (workspace_id, name, description, type, created_by, is_default)
    VALUES (ws.id, 'general', 'Company-wide announcements and conversations', 'public', owner_id, true)
    ON CONFLICT (workspace_id, name) DO NOTHING;

    -- #announcements
    INSERT INTO public.channels (workspace_id, name, description, type, created_by, is_default)
    VALUES (ws.id, 'announcements', 'Important updates from leadership', 'announcement', owner_id, true)
    ON CONFLICT (workspace_id, name) DO NOTHING;

    -- #random
    INSERT INTO public.channels (workspace_id, name, description, type, created_by, is_default)
    VALUES (ws.id, 'random', 'Off-topic conversations and fun', 'public', owner_id, true)
    ON CONFLICT (workspace_id, name) DO NOTHING;

    -- Add all active workspace members to default channels
    FOR ch_id IN
      SELECT id FROM public.channels
      WHERE workspace_id = ws.id AND is_default = true
    LOOP
      INSERT INTO public.channel_members (channel_id, user_id, workspace_id)
      SELECT ch_id, wm.user_id, ws.id
      FROM public.workspace_members wm
      WHERE wm.workspace_id = ws.id AND wm.is_active = true
      ON CONFLICT (channel_id, user_id) DO NOTHING;
    END LOOP;

    -- Seed presence rows for all workspace members
    INSERT INTO public.user_presence (user_id, workspace_id, status)
    SELECT wm.user_id, ws.id, 'offline'
    FROM public.workspace_members wm
    WHERE wm.workspace_id = ws.id AND wm.is_active = true
    ON CONFLICT (user_id) DO NOTHING;

  END LOOP;
END $$;

-- ── 3. TRIGGER: update thread_reply_count on parent ─────────

CREATE OR REPLACE FUNCTION public.update_thread_reply_count()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.parent_message_id IS NOT NULL THEN
    UPDATE public.messages
    SET thread_reply_count = thread_reply_count + 1,
        thread_last_reply_at = NEW.created_at
    WHERE id = NEW.parent_message_id;
  END IF;
  IF TG_OP = 'DELETE' AND OLD.parent_message_id IS NOT NULL THEN
    UPDATE public.messages
    SET thread_reply_count = GREATEST(thread_reply_count - 1, 0)
    WHERE id = OLD.parent_message_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_thread_reply_count ON public.messages;
CREATE TRIGGER trg_thread_reply_count
  AFTER INSERT OR DELETE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_thread_reply_count();

-- ── 4. TRIGGER: update dm last_message_at ───────────────────

CREATE OR REPLACE FUNCTION public.update_dm_last_message_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.conversation_id IS NOT NULL THEN
    UPDATE public.dm_conversations
    SET last_message_at = NEW.created_at
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dm_last_message_at ON public.messages;
CREATE TRIGGER trg_dm_last_message_at
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_dm_last_message_at();

-- ── 5. RLS ───────────────────────────────────────────────────

ALTER TABLE public.channels           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_conversations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_members         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence      ENABLE ROW LEVEL SECURITY;

-- channels: workspace members can see public/announcement channels,
--           private channels only if they are a member
DROP POLICY IF EXISTS "channels select" ON public.channels;
CREATE POLICY "channels select" ON public.channels FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT public.get_my_workspace_ids())
    AND (
      type IN ('public','announcement')
      OR EXISTS (
        SELECT 1 FROM public.channel_members cm
        WHERE cm.channel_id = id AND cm.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "channels insert" ON public.channels;
CREATE POLICY "channels insert" ON public.channels FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));

DROP POLICY IF EXISTS "channels update" ON public.channels;
CREATE POLICY "channels update" ON public.channels FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

DROP POLICY IF EXISTS "channels delete" ON public.channels;
CREATE POLICY "channels delete" ON public.channels FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- channel_members
DROP POLICY IF EXISTS "channel_members select" ON public.channel_members;
CREATE POLICY "channel_members select" ON public.channel_members FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

DROP POLICY IF EXISTS "channel_members insert" ON public.channel_members;
CREATE POLICY "channel_members insert" ON public.channel_members FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));

DROP POLICY IF EXISTS "channel_members update" ON public.channel_members;
CREATE POLICY "channel_members update" ON public.channel_members FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

DROP POLICY IF EXISTS "channel_members delete" ON public.channel_members;
CREATE POLICY "channel_members delete" ON public.channel_members FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

-- dm_conversations: only participants can see
DROP POLICY IF EXISTS "dm_conversations select" ON public.dm_conversations;
CREATE POLICY "dm_conversations select" ON public.dm_conversations FOR SELECT TO authenticated
  USING (
    workspace_id IN (SELECT public.get_my_workspace_ids())
    AND EXISTS (
      SELECT 1 FROM public.dm_members dm
      WHERE dm.conversation_id = id AND dm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "dm_conversations insert" ON public.dm_conversations;
CREATE POLICY "dm_conversations insert" ON public.dm_conversations FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids()));

DROP POLICY IF EXISTS "dm_conversations update" ON public.dm_conversations;
CREATE POLICY "dm_conversations update" ON public.dm_conversations FOR UPDATE TO authenticated
  USING (
    workspace_id IN (SELECT public.get_my_workspace_ids())
    AND EXISTS (
      SELECT 1 FROM public.dm_members dm
      WHERE dm.conversation_id = id AND dm.user_id = auth.uid()
    )
  );

-- dm_members
DROP POLICY IF EXISTS "dm_members select" ON public.dm_members;
CREATE POLICY "dm_members select" ON public.dm_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.dm_conversations dc
      WHERE dc.id = conversation_id
        AND dc.workspace_id IN (SELECT public.get_my_workspace_ids())
    )
    AND EXISTS (
      SELECT 1 FROM public.dm_members dm2
      WHERE dm2.conversation_id = conversation_id AND dm2.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "dm_members insert" ON public.dm_members;
CREATE POLICY "dm_members insert" ON public.dm_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.dm_conversations dc
      WHERE dc.id = conversation_id
        AND dc.workspace_id IN (SELECT public.get_my_workspace_ids())
    )
  );

DROP POLICY IF EXISTS "dm_members update" ON public.dm_members;
CREATE POLICY "dm_members update" ON public.dm_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- messages
DROP POLICY IF EXISTS "messages select" ON public.messages;
CREATE POLICY "messages select" ON public.messages FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

DROP POLICY IF EXISTS "messages insert" ON public.messages;
CREATE POLICY "messages insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT public.get_my_workspace_ids())
              AND sender_id = auth.uid());

DROP POLICY IF EXISTS "messages update" ON public.messages;
CREATE POLICY "messages update" ON public.messages FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

DROP POLICY IF EXISTS "messages delete" ON public.messages;
CREATE POLICY "messages delete" ON public.messages FOR DELETE TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids())
         AND sender_id = auth.uid());

-- message_attachments
DROP POLICY IF EXISTS "message_attachments select" ON public.message_attachments;
CREATE POLICY "message_attachments select" ON public.message_attachments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id
      AND m.workspace_id IN (SELECT public.get_my_workspace_ids())
  ));

DROP POLICY IF EXISTS "message_attachments insert" ON public.message_attachments;
CREATE POLICY "message_attachments insert" ON public.message_attachments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id
      AND m.workspace_id IN (SELECT public.get_my_workspace_ids())
      AND m.sender_id = auth.uid()
  ));

DROP POLICY IF EXISTS "message_attachments delete" ON public.message_attachments;
CREATE POLICY "message_attachments delete" ON public.message_attachments FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id AND m.sender_id = auth.uid()
  ));

-- message_reactions
DROP POLICY IF EXISTS "message_reactions select" ON public.message_reactions;
CREATE POLICY "message_reactions select" ON public.message_reactions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id
      AND m.workspace_id IN (SELECT public.get_my_workspace_ids())
  ));

DROP POLICY IF EXISTS "message_reactions insert" ON public.message_reactions;
CREATE POLICY "message_reactions insert" ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id
      AND m.workspace_id IN (SELECT public.get_my_workspace_ids())
  ));

DROP POLICY IF EXISTS "message_reactions delete" ON public.message_reactions;
CREATE POLICY "message_reactions delete" ON public.message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- user_presence: workspace members can see each other's presence
DROP POLICY IF EXISTS "user_presence select" ON public.user_presence;
CREATE POLICY "user_presence select" ON public.user_presence FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_my_workspace_ids()));

DROP POLICY IF EXISTS "user_presence insert" ON public.user_presence;
CREATE POLICY "user_presence insert" ON public.user_presence FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_presence update" ON public.user_presence;
CREATE POLICY "user_presence update" ON public.user_presence FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ── 6. REALTIME ──────────────────────────────────────────────

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'channels','channel_members','messages',
    'message_reactions','dm_conversations','dm_members','user_presence'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- ── 7. INDEXES ───────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_channels_workspace         ON public.channels(workspace_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_channel    ON public.channel_members(channel_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user       ON public.channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel           ON public.messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation      ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_parent            ON public.messages(parent_message_id) WHERE parent_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_sender            ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message  ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_dm_members_user            ON public.dm_members(user_id);
CREATE INDEX IF NOT EXISTS idx_dm_members_conversation    ON public.dm_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_workspace    ON public.user_presence(workspace_id);
