DROP POLICY IF EXISTS "channels select" ON public.channels;

CREATE POLICY "channels select"
ON public.channels
FOR SELECT
TO authenticated
USING (
  workspace_id IN (SELECT get_my_workspace_ids())
  AND (
    type = ANY (ARRAY['public'::text, 'announcement'::text])
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.channel_members cm
      WHERE cm.channel_id = channels.id
        AND cm.user_id = auth.uid()
    )
  )
);