import { createFileRoute } from "@tanstack/react-router";
import { requireApiKey } from "@/server/api-key-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// GET /api/v1/members?page=1&per_page=50
export const Route = createFileRoute("/api/v1/members")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await requireApiKey(request, "members:read");
        if (ctx instanceof Response) return ctx;

        const url = new URL(request.url);
        const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
        const perPage = Math.min(
          100,
          Math.max(1, parseInt(url.searchParams.get("per_page") ?? "50")),
        );
        const from = (page - 1) * perPage;

        const { data: members, count } = await supabaseAdmin
          .from("workspace_members")
          .select(
            "user_id, role, is_active, joined_at, profiles!inner(id, full_name, email, department, job_title, avatar_url)",
            { count: "exact" },
          )
          .eq("workspace_id", ctx.workspaceId)
          .eq("is_active", true)
          .range(from, from + perPage - 1);

        return Response.json({
          members: members ?? [],
          pagination: { page, per_page: perPage, total: count ?? 0 },
        });
      },
    },
  },
});
