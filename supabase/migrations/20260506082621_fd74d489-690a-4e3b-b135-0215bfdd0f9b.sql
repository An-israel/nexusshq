ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone;
ALTER TABLE public.direct_messages ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone;
-- Allow members to update/delete their own group messages (for edit feature)
DROP POLICY IF EXISTS "members edit own group messages" ON public.group_messages;
CREATE POLICY "members edit own group messages" ON public.group_messages
  FOR UPDATE USING (from_id = auth.uid()) WITH CHECK (from_id = auth.uid());
DROP POLICY IF EXISTS "members delete own group messages" ON public.group_messages;
CREATE POLICY "members delete own group messages" ON public.group_messages
  FOR DELETE USING (from_id = auth.uid());
DROP POLICY IF EXISTS "senders edit own dm" ON public.direct_messages;
CREATE POLICY "senders edit own dm" ON public.direct_messages
  FOR UPDATE USING (from_id = auth.uid() OR to_id = auth.uid());
DROP POLICY IF EXISTS "senders delete own dm" ON public.direct_messages;
CREATE POLICY "senders delete own dm" ON public.direct_messages
  FOR DELETE USING (from_id = auth.uid());