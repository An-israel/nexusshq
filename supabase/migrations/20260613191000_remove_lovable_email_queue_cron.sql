-- The transactional email queue processor (previously
-- src/routes/lovable/email/queue/process.ts, which called
-- @lovable.dev/email-js) has been removed. Auth emails are now sent
-- synchronously via Resend from /api/public/auth-email-webhook, and nothing
-- else enqueues into auth_emails/transactional_emails, so the queue
-- processor cron job is no longer needed.

SELECT cron.unschedule('nexus-email-queue-process')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'nexus-email-queue-process');
