import { createFileRoute } from "@tanstack/react-router";
import { requireApiKey } from "@/server/api-key-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fireWebhooks } from "@/server/webhook-fire.server";

// GET /api/v1/tasks?status=todo&assigned_to=<user_id>&page=1
// POST /api/v1/tasks — create a task (fires task.created webhook)
export const Route = createFileRoute("/api/v1/tasks")({
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
          .from("tasks")
          .select("id, title, description, status, priority, due_date, assigned_to, task_type, progress_percent, created_at", { count: "exact" })
          .eq("workspace_id", ctx.workspaceId)
          .range(from, from + perPage - 1)
          .order("due_date");

        const status = url.searchParams.get("status");
        if (status) query = query.eq("status", status);

        const assignedTo = url.searchParams.get("assigned_to");
        if (assignedTo) query = query.eq("assigned_to", assignedTo);

        const { data: tasks, count } = await query;
        return Response.json({
          tasks: tasks ?? [],
          pagination: { page, per_page: perPage, total: count ?? 0 },
        });
      },

      POST: async ({ request }) => {
        const ctx = await requireApiKey(request);
        if (ctx instanceof Response) return ctx;

        let body: {
          title: string;
          description?: string;
          assigned_to: string;
          due_date: string;
          priority?: "low" | "medium" | "high" | "urgent";
          task_type?: "daily" | "one_time" | "weekly" | "monthly";
        };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        if (!body.title?.trim() || !body.assigned_to || !body.due_date) {
          return Response.json(
            { error: "title, assigned_to, and due_date are required" },
            { status: 400 },
          );
        }

        const { data: task, error } = await supabaseAdmin
          .from("tasks")
          .insert({
            workspace_id: ctx.workspaceId,
            title: body.title.trim(),
            description: body.description ?? null,
            assigned_to: body.assigned_to,
            assigned_by: null,
            due_date: body.due_date,
            priority: body.priority ?? "medium",
            task_type: body.task_type ?? "one_time",
            status: "todo",
          })
          .select()
          .single();

        if (error) return Response.json({ error: error.message }, { status: 500 });

        void fireWebhooks(ctx.workspaceId, "task.created", task).catch(() => {});
        return Response.json({ task }, { status: 201 });
      },
    },
  },
});
