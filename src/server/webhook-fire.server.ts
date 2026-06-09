import { createHmac } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// POSTs a signed JSON payload to all active webhook endpoints subscribed to
// the given event in the workspace. Errors are swallowed — webhook delivery
// is best-effort and must never block the primary request.
export async function fireWebhooks(
  workspaceId: string,
  event: string,
  payload: unknown,
): Promise<void> {
  const { data: endpoints } = await supabaseAdmin
    .from("webhook_endpoints")
    .select("id, url, secret")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .contains("events", [event]);

  if (!endpoints?.length) return;

  const body = JSON.stringify({ event, data: payload, fired_at: new Date().toISOString() });

  await Promise.all(
    endpoints.map(async (ep) => {
      const sig = createHmac("sha256", ep.secret).update(body).digest("hex");
      try {
        const res = await fetch(ep.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Nexus-Signature": `sha256=${sig}`,
            "X-Nexus-Event": event,
          },
          body,
          signal: AbortSignal.timeout(10_000),
        });
        void supabaseAdmin
          .from("webhook_endpoints")
          .update({
            last_fired_at: new Date().toISOString(),
            last_error: res.ok ? null : `HTTP ${res.status}`,
          })
          .eq("id", ep.id);
      } catch (err) {
        void supabaseAdmin
          .from("webhook_endpoints")
          .update({ last_error: String(err) })
          .eq("id", ep.id);
      }
    }),
  );
}
