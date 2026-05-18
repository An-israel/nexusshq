
-- Allow nulls on attribution columns we want to preserve
ALTER TABLE public.objectives ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE public.key_result_updates ALTER COLUMN updated_by DROP NOT NULL;
ALTER TABLE public.messages ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE public.documents ALTER COLUMN uploaded_by DROP NOT NULL;

-- objectives.owner_id -> SET NULL
ALTER TABLE public.objectives DROP CONSTRAINT IF EXISTS objectives_owner_id_fkey;
ALTER TABLE public.objectives
  ADD CONSTRAINT objectives_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- key_results.owner_id -> SET NULL
ALTER TABLE public.key_results DROP CONSTRAINT IF EXISTS key_results_owner_id_fkey;
ALTER TABLE public.key_results
  ADD CONSTRAINT key_results_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- key_result_updates.updated_by -> SET NULL
ALTER TABLE public.key_result_updates DROP CONSTRAINT IF EXISTS key_result_updates_updated_by_fkey;
ALTER TABLE public.key_result_updates
  ADD CONSTRAINT key_result_updates_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- channels.created_by -> SET NULL
ALTER TABLE public.channels DROP CONSTRAINT IF EXISTS channels_created_by_fkey;
ALTER TABLE public.channels
  ADD CONSTRAINT channels_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- dm_conversations.created_by -> SET NULL
ALTER TABLE public.dm_conversations DROP CONSTRAINT IF EXISTS dm_conversations_created_by_fkey;
ALTER TABLE public.dm_conversations
  ADD CONSTRAINT dm_conversations_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- messages.sender_id -> SET NULL
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- messages.pinned_by -> SET NULL
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_pinned_by_fkey;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_pinned_by_fkey
  FOREIGN KEY (pinned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- documents.uploaded_by -> SET NULL
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_uploaded_by_fkey;
ALTER TABLE public.documents
  ADD CONSTRAINT documents_uploaded_by_fkey
  FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- burnout_alerts.user_id -> CASCADE (alerts belong to the user)
ALTER TABLE public.burnout_alerts DROP CONSTRAINT IF EXISTS burnout_alerts_user_id_fkey;
ALTER TABLE public.burnout_alerts
  ADD CONSTRAINT burnout_alerts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- burnout_alerts.acknowledged_by -> SET NULL
ALTER TABLE public.burnout_alerts DROP CONSTRAINT IF EXISTS burnout_alerts_acknowledged_by_fkey;
ALTER TABLE public.burnout_alerts
  ADD CONSTRAINT burnout_alerts_acknowledged_by_fkey
  FOREIGN KEY (acknowledged_by) REFERENCES auth.users(id) ON DELETE SET NULL;
