import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendWebPushToUser } from "@/server/web-push.server";

interface NotifRow {
  user_id: string;
  type: "info" | "warning" | "success" | "error";
  title: string;
  message: string;
}

// Inserts in-app notifications AND fires Web Push for each recipient.
export async function createNotifications(notifs: NotifRow[]): Promise<void> {
  if (!notifs.length) return;
  await supabaseAdmin.from("notifications").insert(notifs);
  await Promise.all(
    notifs.map((n) =>
      sendWebPushToUser(n.user_id, { title: n.title, body: n.message }).catch(() => {}),
    ),
  );
}
