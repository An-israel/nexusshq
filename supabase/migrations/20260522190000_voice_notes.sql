-- Create voice-notes storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-notes',
  'voice-notes',
  true,
  52428800,
  ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav', 'audio/mpeg', 'audio/webm;codecs=opus']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for voice-notes bucket
CREATE POLICY "voice_notes_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'voice-notes');

CREATE POLICY "voice_notes_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'voice-notes');

CREATE POLICY "voice_notes_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'voice-notes' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Main voice_notes table
CREATE TABLE public.voice_notes (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id          uuid REFERENCES public.workspaces(id) ON DELETE CASCADE NOT NULL,
  message_id            uuid REFERENCES public.messages(id) ON DELETE CASCADE UNIQUE NOT NULL,
  sender_id             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  storage_path          text NOT NULL,
  public_url            text NOT NULL,
  duration_seconds      integer,
  waveform_data         jsonb,
  transcription         text,
  transcription_status  text DEFAULT 'pending'
                        CHECK (transcription_status IN ('pending','processing','completed','failed')),
  file_size_bytes       bigint,
  created_at            timestamptz DEFAULT now()
);

ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;

-- Workspace members can read
CREATE POLICY "voice_notes_select" ON public.voice_notes
  FOR SELECT TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Sender can insert their own voice notes
CREATE POLICY "voice_notes_insert" ON public.voice_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Service role (used by transcription API) bypasses RLS automatically
-- Sender can update their own notes (e.g. waveform corrections)
CREATE POLICY "voice_notes_update" ON public.voice_notes
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());
