import { createFileRoute } from "@tanstack/react-router";
import { requireApiKey } from "@/server/api-key-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// GET /api/v1/workspace — returns public workspace metadata
export const Route = createFileRoute("/api/v1/workspace")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await requireApiKey(request, "workspace:read");
        if (ctx instanceof Response) return ctx;

        const { data: ws } = await supabaseAdmin
          .from("workspaces")
          .select("id, name, slug, plan, plan_seats, created_at")
          .eq("id", ctx.workspaceId)
          .single();

        if (!ws) return Response.json({ error: "Workspace not found" }, { status: 404 });
        return Response.json({ workspace: ws });
      },
    },
  },
});
