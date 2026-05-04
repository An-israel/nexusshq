-- ============================================================
-- Group messaging tables, in-app notification triggers,
-- delayed email notification cron (5-min unread check).
-- ============================================================

-- 1. Extend notification_type enum
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'direct_message';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'group_message';

-- 2. Email-sent tracking on notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;

-- 3. Group messaging tables

CREATE TABLE IF NOT EXISTS public.message_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.message_group_members (
  group_id    UUID NOT NULL REFERENCES public.message_groups(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.group_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   UUID NOT NULL REFERENCES public.message_groups(id) ON DELETE CASCADE,
  from_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS group_messages_group_created_idx
  ON public.group_messages(group_id, created_at);

-- 4. RLS

ALTER TABLE public.message_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_messages        ENABLE ROW LEVEL SECURITY;

-- Security-definer helper avoids RLS recursion in member policies
CREATE OR REPLACE FUNCTION public.is_group_member(p_group_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.message_group_members
    WHERE group_id = p_group_id AND user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_group_member(UUID, UUID) TO authenticated;

DO $$ BEGIN
  -- message_groups
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='message_groups' AND policyname='members view groups') THEN
    CREATE POLICY "members view groups" ON public.message_groups
      FOR SELECT USING (public.is_group_member(id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='message_groups' AND policyname='authenticated create groups') THEN
    CREATE POLICY "authenticated create groups" ON public.message_groups
      FOR INSERT WITH CHECK (auth.uid() = created_by);
  END IF;

  -- message_group_members
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='message_group_members' AND policyname='members view members') THEN
    CREATE POLICY "members view members" ON public.message_group_members
      FOR SELECT USING (public.is_group_member(group_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='message_group_members' AND policyname='members add members') THEN
    CREATE POLICY "members add members" ON public.message_group_members
      FOR INSERT WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.message_groups WHERE id = group_id AND created_by = auth.uid())
        OR public.is_group_member(group_id, auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='message_group_members' AND policyname='members update own last_read') THEN
    CREATE POLICY "members update own last_read" ON public.message_group_members
      FOR UPDATE USING (user_id = auth.uid());
  END IF;

  -- group_messages
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_messages' AND policyname='members view group messages') THEN
    CREATE POLICY "members view group messages" ON public.group_messages
      FOR SELECT USING (public.is_group_member(group_id, auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='group_messages' AND policyname='members send group messages') THEN
    CREATE POLICY "members send group messages" ON public.group_messages
      FOR INSERT WITH CHECK (from_id = auth.uid() AND public.is_group_member(group_id, auth.uid()));
  END IF;
END $$;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_groups;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;

-- 5. In-app notification triggers

CREATE OR REPLACE FUNCTION public.notify_on_direct_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sender_name TEXT;
BEGIN
  SELECT full_name INTO sender_name FROM public.profiles WHERE id = NEW.from_id;
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (NEW.to_id, 'direct_message', sender_name || ' sent you a message', NEW.body);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_direct_message_sent ON public.direct_messages;
CREATE TRIGGER on_direct_message_sent
  AFTER INSERT ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_direct_message();

CREATE OR REPLACE FUNCTION public.notify_on_group_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sender_name TEXT;
  group_name  TEXT;
  rec         RECORD;
BEGIN
  SELECT full_name INTO sender_name FROM public.profiles WHERE id = NEW.from_id;
  SELECT name      INTO group_name  FROM public.message_groups WHERE id = NEW.group_id;
  FOR rec IN
    SELECT user_id FROM public.message_group_members
    WHERE group_id = NEW.group_id AND user_id != NEW.from_id
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (rec.user_id, 'group_message', sender_name || ' in ' || group_name, NEW.body);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_group_message_sent ON public.group_messages;
CREATE TRIGGER on_group_message_sent
  AFTER INSERT ON public.group_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_group_message();

-- 6. Cron: send email for unread message notifications older than 5 min
SELECT cron.schedule(
  'nexus-message-email-notify',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--1a191282-4857-4af0-8b72-38cc1bac2a29.lovable.app/api/public/cron/message-email',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

NOTIFY pgrst, 'reload schema';
