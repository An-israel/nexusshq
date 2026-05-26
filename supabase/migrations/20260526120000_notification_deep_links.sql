-- Add deep-link columns to notifications so clicking a notification can
-- navigate directly to the relevant channel or DM conversation.
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS related_channel_id uuid REFERENCES public.channels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_conversation_id uuid REFERENCES public.dm_conversations(id) ON DELETE SET NULL;
