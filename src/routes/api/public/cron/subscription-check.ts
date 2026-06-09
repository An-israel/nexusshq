import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyCronRequest } from "@/server/cron-auth.server";

// Called by pg_cron daily at 02:00 UTC.
// Marks expired active subscriptions as past_due, and downgrades workspaces
// that have been past_due for more than 14 days (grace period) to starter.
export const Route = createFileRoute("/api/public/cron/subscription-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authError = verifyCronRequest(request);
        if (authError) return authError;

        const now = new Date().toISOString();
        const graceCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

        // 1. Active subscriptions whose period ended → past_due
        const { data: expired } = await supabaseAdmin
          .from("subscriptions")
          .select("id, workspace_id")
          .eq("status", "active")
          .lt("current_period_end", now);

        let markedPastDue = 0;
        for (const sub of expired ?? []) {
          await supabaseAdmin.from("subscriptions").update({ status: "past_due" }).eq("id", sub.id);
          await notifyWorkspaceAdmins(sub.workspace_id, {
            title: "Subscription expired",
            message:
              "Your workspace subscription has expired. Renew to keep full access for all members.",
          });
          markedPastDue++;
        }

        // 2. Past_due subscriptions beyond the grace period → downgrade to starter
        const { data: overdue } = await supabaseAdmin
          .from("subscriptions")
          .select("id, workspace_id")
          .eq("status", "past_due")
          .lt("current_period_end", graceCutoff);

        let downgraded = 0;
        for (const sub of overdue ?? []) {
          await Promise.all([
            supabaseAdmin.from("subscriptions").update({ status: "cancelled" }).eq("id", sub.id),
            supabaseAdmin
              .from("workspaces")
              .update({ plan: "starter", plan_seats: 5 })
              .eq("id", sub.workspace_id),
          ]);
          await notifyWorkspaceAdmins(sub.workspace_id, {
            title: "Workspace downgraded",
            message:
              "Your workspace has been downgraded to the Starter plan. Upgrade to restore previous limits.",
          });
          downgraded++;
        }

        return Response.json({ markedPastDue, downgraded });
      },
      GET: async () => Response.json({ ok: true }),
    },
  },
});

async function notifyWorkspaceAdmins(
  workspaceId: string,
  notif: { title: string; message: string },
) {
  const { data: wm } = await supabaseAdmin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId);
  if (!wm?.length) return;

  const memberIds = wm.map((m) => m.user_id);
  const { data: adminRoles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .in("user_id", memberIds);

  const notifs = (adminRoles ?? []).map((r) => ({
    user_id: r.user_id,
    type: "warning" as const,
    ...notif,
  }));
  if (notifs.length) await supabaseAdmin.from("notifications").insert(notifs);
}
