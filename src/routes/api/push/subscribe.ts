import { createFileRoute } from "@tanstack/react-router";
import { requireApiUser } from "@/server/api-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface SubscribeBody {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export const Route = createFileRoute("/api/push/subscribe")({
  server: {
    handlers: {
      // Register a push subscription for the authenticated user
      POST: async ({ request }) => {
        const user = await requireApiUser(request);
        if (user instanceof Response) return user;

        let body: SubscribeBody;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const { endpoint, keys } = body;
        if (!endpoint || !keys?.p256dh || !keys?.auth) {
          return Response.json({ error: "Missing required subscription fields" }, { status: 400 });
        }

        await supabaseAdmin
          .from("push_subscriptions")
          .upsert(
            { user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
            { onConflict: "user_id,endpoint" },
          );

        return Response.json({ ok: true });
      },

      // Remove a push subscription
      DELETE: async ({ request }) => {
        const user = await requireApiUser(request);
        if (user instanceof Response) return user;

        let body: { endpoint: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        if (!body.endpoint) {
          return Response.json({ error: "Missing endpoint" }, { status: 400 });
        }

        await supabaseAdmin
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", body.endpoint);

        return Response.json({ ok: true });
      },
    },
  },
});
