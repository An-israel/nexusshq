-- voice_notes was never added to the supabase_realtime publication, so the
-- VoiceNotePlayer's postgres_changes subscription (used to pick up
-- transcription_status updates) never received any events.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_notes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.voice_notes REPLICA IDENTITY FULL;
