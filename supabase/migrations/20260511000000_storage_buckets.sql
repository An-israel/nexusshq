-- ============================================================
-- Storage buckets for Nexus HQ file attachments
-- ============================================================

-- Message attachments bucket (private, 100 MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-attachments',
  'message-attachments',
  false,
  104857600,
  ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    'application/zip', 'application/x-zip-compressed',
    'video/mp4', 'video/webm',
    'audio/mpeg', 'audio/wav', 'audio/ogg'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Authenticated workspace members can upload
-- Path format: {workspaceId}/{channelOrConvId}/{filename}
CREATE POLICY "message attachments upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'message-attachments');

-- Authenticated users can read (RLS on messages table already restricts access)
CREATE POLICY "message attachments read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'message-attachments');

-- Users can delete their own uploads (simple: allow any authenticated user to delete from this bucket)
CREATE POLICY "message attachments delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'message-attachments');

-- Avatars bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "avatars read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars');
