import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getNotificationUrl } from "@/lib/notifications/get-notification-url";

const CTA_LABELS: Record<string, string> = {
  task_assigned: "View Task",
  task_due_soon: "View Task",
  task_overdue: "View Task",
  mention: "Open Channel",
  group_message: "Open Channel",
  direct_message: "Open Conversation",
  clock_reminder: "Go to Attendance",
  kpi_reminder: "View Goals",
  warning: "Open Dashboard",
  flag: "Open Dashboard",
  announcement: "View Announcement",
};

// Called by pg_cron every 5 minutes.
// Sends an email for any notification that is still unread 5+ minutes after
// it was created — covers task assignments, @mentions, direct/group messages,
// announcements, warnings/flags, reminders, etc. Users who already saw a
// notification in-app within that window never get an email for it.
export const Route = createFileRoute("/api/public/cron/message-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.RESEND_API_KEY;
        const fromEmail = process.env.RESEND_FROM_EMAIL ?? "notifications@nexxoshq.app";
        const baseUrl = new URL(request.url).origin;

        if (!apiKey) {
          return Response.json({
            skipped: true,
            reason: "RESEND_API_KEY not set",
          });
        }

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        // Find unread notifications older than 5 min with no email sent yet
        const { data: notifs, error } = await supabaseAdmin
          .from("notifications")
          .select(
            "id, user_id, workspace_id, type, title, message, related_task_id, related_channel_id, related_conversation_id",
          )
          .eq("is_read", false)
          .is("email_sent_at", null)
          .lt("created_at", fiveMinutesAgo);

        if (error) return new Response(error.message, { status: 500 });
        if (!notifs?.length) return Response.json({ sent: 0 });

        // Batch-fetch the recipients' emails
        const userIds = [...new Set(notifs.map((n) => n.user_id))];
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);

        const profileByUserId = Object.fromEntries(
          (profiles ?? []).map((p) => [p.id, { email: p.email, name: p.full_name }]),
        );

        // Batch-fetch workspace slugs so we can build deep-links into the right workspace
        const workspaceIds = [
          ...new Set(notifs.map((n) => n.workspace_id).filter(Boolean)),
        ] as string[];
        const { data: workspaces } = workspaceIds.length
          ? await supabaseAdmin.from("workspaces").select("id, slug").in("id", workspaceIds)
          : { data: [] as { id: string; slug: string }[] };

        const slugByWorkspaceId = Object.fromEntries((workspaces ?? []).map((w) => [w.id, w.slug]));

        let sent = 0;
        const sentIds: string[] = [];

        for (const notif of notifs) {
          const recipient = profileByUserId[notif.user_id];
          if (!recipient?.email) continue;

          const workspaceSlug = notif.workspace_id ? slugByWorkspaceId[notif.workspace_id] : null;
          const path = workspaceSlug ? getNotificationUrl(notif, workspaceSlug) : null;
          const ctaUrl = path ? `${baseUrl}${path}` : `${baseUrl}/workspaces`;
          const ctaLabel = CTA_LABELS[notif.type] ?? "Open Nexxos HQ";

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
              html: `
                <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                  <h2 style="margin-bottom:8px">${notif.title}</h2>
                  <p style="color:#555;margin-bottom:24px">${notif.message}</p>
                  <a href="${ctaUrl}"
                     style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block">
                    ${ctaLabel}
                  </a>
                  <p style="color:#9ca3af;font-size:12px;margin-top:24px">
                    You're receiving this because you have an unread notification on Nexxos HQ.
                  </p>
                </div>`,
            }),
          });

          if (res.ok) {
            sent++;
            sentIds.push(notif.id);
          }
        }

        // Mark emails as sent
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
