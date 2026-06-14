import * as React from "react";
import { render as renderAsync } from "@react-email/components";
import { Webhook } from "standardwebhooks";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SignupEmail } from "@/lib/email-templates/signup";
import { InviteEmail } from "@/lib/email-templates/invite";
import { MagicLinkEmail } from "@/lib/email-templates/magic-link";
import { RecoveryEmail } from "@/lib/email-templates/recovery";
import { EmailChangeEmail } from "@/lib/email-templates/email-change";
import { ReauthenticationEmail } from "@/lib/email-templates/reauthentication";

const SITE_NAME = "Nexxos HQ";

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: "Confirm your email",
  invite: "You've been invited",
  magiclink: "Your login link",
  recovery: "Reset your password",
  email_change: "Confirm your new email",
  reauthentication: "Your verification code",
};

const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
};

function redactEmail(email: string | null | undefined): string {
  if (!email) return "***";
  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) return "***";
  return `${localPart[0]}***@${domain}`;
}

interface AuthHookPayload {
  user: { email: string; new_email?: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new?: string;
    email_new?: string;
  };
}

// Supabase Auth "Send Email" hook: https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook
// Verified via the Standard Webhooks spec using SUPABASE_AUTH_HOOK_SECRET
// (configured as the hook's secret in Supabase Dashboard -> Authentication -> Hooks),
// then renders the matching React Email template and sends it via Resend.
export const Route = createFileRoute("/api/public/auth-email-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const hookSecret = process.env.SUPABASE_AUTH_HOOK_SECRET;
        const resendApiKey = process.env.RESEND_API_KEY;
        const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@nexus.skryveai.com";

        if (!hookSecret || !resendApiKey) {
          console.error("Missing SUPABASE_AUTH_HOOK_SECRET or RESEND_API_KEY");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        const body = await request.text();
        const headers = Object.fromEntries(request.headers.entries());

        let payload: AuthHookPayload;
        try {
          payload = new Webhook(hookSecret).verify(body, headers) as AuthHookPayload;
        } catch (error) {
          console.error("Auth email webhook signature verification failed", { error });
          return Response.json({ error: "Invalid signature" }, { status: 401 });
        }

        const { user, email_data } = payload;
        const emailType = email_data.email_action_type;

        const EmailTemplate = EMAIL_TEMPLATES[emailType];
        if (!EmailTemplate) {
          console.error("Unknown auth email type", { emailType });
          return Response.json({ error: `Unknown email type: ${emailType}` }, { status: 400 });
        }

        const siteUrl = email_data.site_url || "https://nexus.skryveai.com";
        const confirmationUrl =
          `${siteUrl}/auth/v1/verify?token=${email_data.token_hash}` +
          `&type=${emailType}&redirect_to=${encodeURIComponent(email_data.redirect_to)}`;

        // For email_change, Supabase fires this hook once per recipient (old and
        // new address). `user.email` is always the recipient of *this* call.
        const recipient = user.email;

        const templateProps = {
          siteName: SITE_NAME,
          siteUrl,
          recipient,
          confirmationUrl,
          token: email_data.token,
          email: recipient,
          oldEmail: user.email,
          newEmail: email_data.email_new ?? user.new_email,
        };

        const element = React.createElement(EmailTemplate, templateProps);
        const html = await renderAsync(element);
        const text = await renderAsync(element, { plainText: true });

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${SITE_NAME} <${fromEmail}>`,
            to: [recipient],
            subject: EMAIL_SUBJECTS[emailType] ?? "Notification",
            html,
            text,
          }),
        });

        const messageId = crypto.randomUUID();
        if (!res.ok) {
          const errorBody = await res.text();
          console.error("Failed to send auth email via Resend", {
            emailType,
            email_redacted: redactEmail(recipient),
            status: res.status,
            error: errorBody,
          });
          await supabaseAdmin.from("email_send_log").insert({
            message_id: messageId,
            template_name: emailType,
            recipient_email: recipient,
            status: "failed",
            error_message: errorBody.slice(0, 1000),
          });
          // Non-2xx tells Supabase to retry the hook.
          return Response.json({ error: "Failed to send email" }, { status: 500 });
        }

        await supabaseAdmin.from("email_send_log").insert({
          message_id: messageId,
          template_name: emailType,
          recipient_email: recipient,
          status: "sent",
        });

        console.log("Auth email sent", { emailType, email_redacted: redactEmail(recipient) });

        return Response.json({});
      },
    },
  },
});
