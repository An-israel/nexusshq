import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendWebPushToUser } from "@/server/web-push.server";
import { fireWebhooks } from "@/server/webhook-fire.server";

interface NotifRow {
  user_id: string;
  type:
    | "info"
    | "warning"
    | "task_assigned"
    | "task_due_soon"
    | "task_overdue"
    | "flag"
    | "kpi_reminder"
    | "clock_reminder"
    | "direct_message"
    | "group_message"
    | "mention"
    | "announcement";
  title: string;
  message: string;
}

// Inserts in-app notifications, fires Web Push for each recipient, and
// optionally triggers outbound webhooks for the workspace.
export async function createNotifications(
  notifs: NotifRow[],
  options?: { workspaceId?: string; webhookEvent?: string; webhookPayload?: unknown },
): Promise<void> {
  if (!notifs.length) return;
  await supabaseAdmin.from("notifications").insert(notifs);
  const tasks: Promise<void>[] = notifs.map((n) =>
    sendWebPushToUser(n.user_id, { title: n.title, body: n.message }).catch(() => {}),
  );
  if (options?.workspaceId && options?.webhookEvent) {
    tasks.push(
      fireWebhooks(options.workspaceId, options.webhookEvent, options.webhookPayload ?? {}).catch(
        () => {},
      ),
    );
  }
  await Promise.all(tasks);
}
