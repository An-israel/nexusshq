# Nexxos HQ

A multi-tenant team operations platform (tasks, attendance, standups, leave,
reviews, payslips, OKRs, messaging, and more) built on TanStack Start and
Supabase.

## Tech stack

- **Frontend**: React + TanStack Start (file-based routing in `src/routes`)
- **Database/Auth**: Supabase Postgres with Row Level Security
- **Deploy**: Cloudflare Workers (`wrangler.jsonc`) or Vercel (`vercel.json`)
- **Email**: Resend (transactional/cron emails + auth emails via Supabase Auth Hook)
- **Push notifications**: Web Push (VAPID)
- **Payments**: Paystack

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your values (see comments in the
   file for where each value comes from):

   ```bash
   cp .env.example .env
   ```

3. Start the dev server:

   ```bash
   npm run dev
   ```

## Database migrations

SQL migrations live in `supabase/migrations/` and are applied in filename
order. Apply them to your Supabase project via the Supabase CLI or SQL
editor. CI validates that all migrations apply cleanly to a fresh database.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm test` — run the Vitest test suite
- `npx tsc --noEmit` — type check

## Cron jobs

Several routes under `src/routes/api/public/cron/` are meant to be called by
`pg_cron` on a schedule (see the `cron.schedule(...)` calls in
`supabase/migrations/`). They authenticate via a bearer token compared
against `SUPABASE_SERVICE_ROLE_KEY` (`src/server/cron-auth.server.ts`).

## Email delivery (Resend)

By default, a new Resend account is in **sandbox mode**: it can only send
email to the account owner's verified address, regardless of `RESEND_FROM_EMAIL`.
To send notification/cron/transactional emails to real users in production:

1. Add and verify a sending domain in the Resend dashboard.
2. Set `RESEND_FROM_EMAIL` to an address on that verified domain.

Until this is done, emails sent via `src/routes/api/public/cron/*` and the
auth email webhook below will only be delivered to the Resend account owner.

## Auth emails (Supabase Auth Hook)

Signup, invite, magic link, password recovery, email change, and
reauthentication emails are sent via Supabase's [Auth "Send Email"
hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook),
handled by `src/routes/api/public/auth-email-webhook.ts`. To configure it:

1. In the Supabase Dashboard, go to **Authentication -> Hooks -> Send Email**
   and enable it, pointing at
   `https://<your-app-domain>/api/public/auth-email-webhook`.
2. Supabase will show a signing secret in the form `v1,whsec_...` — set this
   as `SUPABASE_AUTH_HOOK_SECRET`.
3. Ensure `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are set (see above).

The webhook verifies the request via the Standard Webhooks spec, renders the
matching template from `src/lib/email-templates/`, and sends it via Resend.
A non-2xx response tells Supabase to retry. Sent/failed attempts are logged
to the `email_send_log` table.
