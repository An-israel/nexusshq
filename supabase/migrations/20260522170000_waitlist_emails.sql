-- ── Waitlist emails table for /coming-soon page ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.waitlist_emails (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  email      text        NOT NULL,
  page       text,
  created_at timestamptz DEFAULT now()
);

-- Prevent duplicate emails per page (or globally if page is null)
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_emails_email_page_idx
  ON public.waitlist_emails (email, COALESCE(page, ''));

ALTER TABLE public.waitlist_emails ENABLE ROW LEVEL SECURITY;

-- Anyone (anon or authenticated) can join the waitlist
CREATE POLICY "waitlist_insert" ON public.waitlist_emails
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Only service role reads (no public data exposure)
