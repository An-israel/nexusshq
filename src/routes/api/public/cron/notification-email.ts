import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyCronRequest } from "@/server/cron-auth.server";

// Called by pg_cron every 5 minutes.
// Sends email for any unread non-message notification with no email sent yet.
// direct_message / group_message are handled by the message-email cron.
export const Route = createFileRoute("/api/public/cron/notification-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authError = verifyCronRequest(request);
        if (authError) return authError;

        const apiKey = process.env.RESEND_API_KEY;
        const fromEmail = process.env.RESEND_FROM_EMAIL ?? "notifications@nexxoshq.app";

        if (!apiKey) {
          return Response.json({ skipped: true, reason: "RESEND_API_KEY not set" });
        }

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        const { data: notifs, error } = await supabaseAdmin
          .from("notifications")
          .select("id, user_id, type, title, message, workspace_id")
          .not("type", "in", '("direct_message","group_message")')
          .eq("is_read", false)
          .is("email_sent_at", null)
          .lt("created_at", fiveMinutesAgo)
          .limit(200);

        if (error) return new Response(error.message, { status: 500 });
        if (!notifs?.length) return Response.json({ sent: 0 });

        const userIds = [...new Set(notifs.map((n) => n.user_id))];
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);

        const recipientByUser = Object.fromEntries(
          (profiles ?? []).map((p) => [p.id, { email: p.email, name: p.full_name }]),
        );

        const appUrl = process.env.APP_URL ?? "https://nexxoshq.app";

        let sent = 0;
        const sentIds: string[] = [];

        for (const notif of notifs) {
          const recipient = recipientByUser[notif.user_id];
          if (!recipient?.email) continue;

          const ctaUrl = buildCtaUrl(appUrl, notif.type, notif.workspace_id);

          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: `Nexxos HQ <${fromEmail}>`,
              to: [recipient.email],
              subject: notif.title,
              html: buildEmailHtml({
                recipientName: recipient.name ?? "there",
                title: notif.title,
                message: notif.message,
                ctaUrl,
                ctaLabel: ctaLabelForType(notif.type),
              }),
            }),
          });

          if (res.ok) {
            sent++;
            sentIds.push(notif.id);
          }
        }

        if (sentIds.length) {
          await supabaseAdmin
            .from("notifications")
            .update({ email_sent_at: new Date().toISOString() })
            .in("id", sentIds);
        }

        return Response.json({ sent });
      },
      GET: async () => Response.json({ ok: true }),
    },
  },
});

type NotifType = string;

function buildCtaUrl(appUrl: string, type: NotifType, workspaceId: string | null): string {
  // We don't have the slug here, so link to the root; a future improvement
  // could join workspaces to get the slug.
  void workspaceId;
  const paths: Record<string, string> = {
    task_assigned: "/",
    task_due_soon: "/",
    task_overdue: "/",
    warning: "/",
    flag: "/",
    kpi_reminder: "/",
    clock_reminder: "/",
    mention: "/",
    info: "/",
    announcement: "/",
  };
  const path = paths[type] ?? "/";
  return `${appUrl}${path}`;
}

function ctaLabelForType(type: NotifType): string {
  const labels: Record<string, string> = {
    task_assigned: "View Task",
    task_due_soon: "View Task",
    task_overdue: "View Task",
    warning: "View Details",
    flag: "View Flag",
    kpi_reminder: "View KPIs",
    clock_reminder: "Clock In",
    mention: "View Message",
    info: "Open App",
    announcement: "Read Announcement",
  };
  return labels[type] ?? "Open App";
}

function buildEmailHtml(opts: {
  recipientName: string;
  title: string;
  message: string;
  ctaUrl: string;
  ctaLabel: string;
}): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)">
        <tr><td style="background:#0f0f0f;padding:20px 32px">
          <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff">Nexxos HQ</p>
        </td></tr>
        <tr><td style="padding:32px">
          <p style="margin:0 0 4px;font-size:13px;color:#888">Hi ${opts.recipientName},</p>
          <h2 style="margin:0 0 12px;font-size:18px;font-weight:700;color:#0f0f0f">${opts.title}</h2>
          <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6">${opts.message}</p>
          <table cellpadding="0" cellspacing="0"><tr><td>
            <a href="${opts.ctaUrl}" style="display:inline-block;background:#0f0f0f;color:#ffffff;font-size:13px;font-weight:600;padding:11px 24px;border-radius:8px;text-decoration:none">
              ${opts.ctaLabel} →
            </a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee">
          <p style="margin:0;font-size:11px;color:#aaa">© Nexxos HQ · nexxoshq.app · You received this because you have an account on Nexxos HQ.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
