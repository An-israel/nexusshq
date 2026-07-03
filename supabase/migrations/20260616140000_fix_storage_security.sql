-- Security hardening: fix publicly-readable storage buckets and exposed invitation secrets
--
-- 1. standup-screenshots: make private (was public = true in live DB due to migration drift)
-- 2. voice-notes: make private + add workspace-scoped SELECT policy
-- 3. workspace_invitations: revoke column-level SELECT on token/passcode for authenticated role

-- ── 1. standup-screenshots: private ─────────────────────────────────────────
UPDATE storage.buckets SET public = false WHERE id = 'standup-screenshots';

DROP POLICY IF EXISTS "standup screenshots public read"          ON storage.objects;
DROP POLICY IF EXISTS "public read screenshots"                  ON storage.objects;
DROP POLICY IF EXISTS "standup screenshots authenticated read"   ON storage.objects;

-- Any authenticated user may view standup screenshots — workspace RLS on the
-- standups table already controls who can reach the screenshot URLs.
CREATE POLICY "standup screenshots authenticated read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'standup-screenshots');

-- Convert stored public URLs → storage paths so signed-URL display works.
-- Rows that already contain a plain path (no 'http') are untouched.
UPDATE public.standups
SET screenshot_url = regexp_replace(
  screenshot_url,
  '^https?://[^/]+/storage/v[0-9]+/object/public/standup-screenshots/',
  ''
)
WHERE screenshot_url IS NOT NULL
  AND screenshot_url LIKE 'http%standup-screenshots%';

-- ── 2. voice-notes: private + workspace-scoped SELECT ────────────────────────
UPDATE storage.buckets SET public = false WHERE id = 'voice-notes';

DROP POLICY IF EXISTS "voice_notes_storage_select" ON storage.objects;
CREATE POLICY "voice_notes_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] IN (
      SELECT public.get_my_workspace_ids()::text
    )
  );

-- ── 3. workspace_invitations: revoke raw token/passcode from authenticated ───
-- The application never selects these columns client-side; server functions
-- use service_role which bypasses column-level grants.
REVOKE SELECT (token, passcode) ON public.workspace_invitations FROM authenticated;
