import { createFileRoute } from "@tanstack/react-router";
import { requireApiKey } from "@/server/api-key-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// GET /api/v1/attendance?date=2026-06-09&user_id=<uuid>&page=1
export const Route = createFileRoute("/api/v1/attendance")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await requireApiKey(request);
        if (ctx instanceof Response) return ctx;

        const url = new URL(request.url);
        const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"));
        const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get("per_page") ?? "50")));
        const from = (page - 1) * perPage;

        let query = supabaseAdmin
          .from("attendance")
          .select(
            "id, user_id, date, clock_in, clock_out, status, total_minutes, created_at",
            { count: "exact" },
          )
          .eq("workspace_id", ctx.workspaceId)
          .range(from, from + perPage - 1)
          .order("date", { ascending: false });

        const date = url.searchParams.get("date");
        if (date) query = query.eq("date", date);

        const userId = url.searchParams.get("user_id");
        if (userId) query = query.eq("user_id", userId);

        const dateFrom = url.searchParams.get("date_from");
        if (dateFrom) query = query.gte("date", dateFrom);

        const dateTo = url.searchParams.get("date_to");
        if (dateTo) query = query.lte("date", dateTo);

        const { data: records, count } = await query;
        return Response.json({
          attendance: records ?? [],
          pagination: { page, per_page: perPage, total: count ?? 0 },
        });
      },
    },
  },
});
