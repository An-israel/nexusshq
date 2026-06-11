# Nexxos HQ

A multi-tenant team operations platform (tasks, attendance, standups, leave,
reviews, payslips, OKRs, messaging, and more) built on TanStack Start and
Supabase.

## Tech stack

- **Frontend**: React + TanStack Start (file-based routing in `src/routes`)
- **Database/Auth**: Supabase Postgres with Row Level Security
- **Deploy**: Cloudflare Workers (`wrangler.jsonc`) or Vercel (`vercel.json`)
- **Email**: Resend (transactional/cron emails) + Lovable email queue
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

Until this is done, emails sent via `src/routes/api/public/cron/*` and
`enqueue_email` will only be delivered to the Resend account owner.
