import { createFileRoute } from "@tanstack/react-router";
import { requireApiUser } from "@/server/api-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/apikeys/$id")({
  server: {
    handlers: {
      // Revoke (soft-delete) an API key
      DELETE: async ({ request, params }) => {
        const user = await requireApiUser(request);
        if (user instanceof Response) return user;

        // Verify the key belongs to a workspace the user administers
        const { data: key } = await supabaseAdmin
          .from("api_keys")
          .select("id, workspace_id")
          .eq("id", params.id)
          .maybeSingle();

        if (!key) return Response.json({ error: "Not found" }, { status: 404 });

        const { data: mem } = await supabaseAdmin
          .from("workspace_members")
          .select("role")
          .eq("workspace_id", key.workspace_id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!mem || !["owner", "admin"].includes(mem.role)) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        await supabaseAdmin.from("api_keys").update({ is_active: false }).eq("id", params.id);
        return Response.json({ ok: true });
      },
    },
  },
});
