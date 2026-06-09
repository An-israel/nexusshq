import { createFileRoute } from "@tanstack/react-router";
import { requireApiUser } from "@/server/api-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/webhooks/$id")({
  server: {
    handlers: {
      DELETE: async ({ request, params }) => {
        const user = await requireApiUser(request);
        if (user instanceof Response) return user;

        const { data: ep } = await supabaseAdmin
          .from("webhook_endpoints")
          .select("id, workspace_id")
          .eq("id", params.id)
          .maybeSingle();

        if (!ep) return Response.json({ error: "Not found" }, { status: 404 });

        const { data: mem } = await supabaseAdmin
          .from("workspace_members")
          .select("role")
          .eq("workspace_id", ep.workspace_id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!mem || !["owner", "admin"].includes(mem.role)) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        await supabaseAdmin.from("webhook_endpoints").delete().eq("id", params.id);
        return Response.json({ ok: true });
      },
    },
  },
});
