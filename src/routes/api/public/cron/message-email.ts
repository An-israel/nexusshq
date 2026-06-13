import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyCronRequest } from "@/server/cron-auth.server";
import { escapeHtml } from "@/lib/nexus";

// Called by pg_cron every 5 minutes.
// Sends an email for any message notification that is still unread after 5 minutes.
export const Route = createFileRoute("/api/public/cron/message-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authError = verifyCronRequest(request);
        if (authError) return authError;

        const apiKey = process.env.RESEND_API_KEY;
        const fromEmail = process.env.RESEND_FROM_EMAIL ?? "notifications@nexxoshq.app";

        if (!apiKey) {
          return Response.json({
            skipped: true,
            reason: "RESEND_API_KEY not set",
          });
        }

        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        // Find unread message notifications older than 5 min with no email sent yet
        const { data: notifs, error } = await supabaseAdmin
          .from("notifications")
          .select("id, user_id, title, message")
          .in("type", ["direct_message", "group_message"])
          .eq("is_read", false)
          .is("email_sent_at", null)
          .lt("created_at", fiveMinutesAgo);

        if (error) return new Response(error.message, { status: 500 });
        if (!notifs?.length) return Response.json({ sent: 0 });

        // Batch-fetch the users' emails
        const userIds = [...new Set(notifs.map((n) => n.user_id))];
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, email, full_name")
          .in("id", userIds);

        const emailByUserId = Object.fromEntries(
          (profiles ?? []).map((p) => [p.id, { email: p.email, name: p.full_name }]),
        );

        let sent = 0;
        const sentIds: string[] = [];

        for (const notif of notifs) {
          const recipient = emailByUserId[notif.user_id];
          if (!recipient?.email) continue;

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
                  <h2 style="margin-bottom:8px">${escapeHtml(notif.title)}</h2>
                  <p style="color:#555;margin-bottom:24px">${escapeHtml(notif.message)}</p>
                  <a href="${process.env.APP_URL ?? "https://nexus.skryveai.com"}/messages"
                     style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none">
                    Open Messages
                  </a>
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
