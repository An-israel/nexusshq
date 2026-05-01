import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Called by pg_cron every Monday at 07:00 UTC
// Schedule in Supabase SQL editor:
//   SELECT cron.schedule(
//     'nexus-late-task-report',
//     '0 7 * * 1',
//     $$ SELECT net.http_post(url := 'https://<your-domain>/api/public/cron/late-task-report',
//          headers := '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb); $$
//   );
export const Route = createFileRoute("/api/public/cron/late-task-report")({
  server: {
    handlers: {
      POST: async () => {
        const now = new Date();
        const monday = new Date(now);
        monday.setDate(now.getDate() - now.getDay() - 6);
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        const weekStart = monday.toISOString().slice(0, 10);
        const weekEnd = sunday.toISOString().slice(0, 10);

        const { data: lateTasks, error } = await supabaseAdmin
          .from("tasks")
          .select("id, title, assigned_to, due_date, status, priority")
          .in("status", ["todo", "in_progress", "overdue"])
          .gte("due_date", weekStart)
          .lte("due_date", weekEnd)
          .order("due_date");

        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        const rows = lateTasks ?? [];
        if (rows.length === 0) {
          return Response.json({ message: "No late tasks this week", count: 0 });
        }

        const byUser: Record<string, typeof rows> = {};
        rows.forEach((t) => {
          if (!byUser[t.assigned_to]) byUser[t.assigned_to] = [];
          byUser[t.assigned_to].push(t);
        });

        const userIds = Object.keys(byUser);
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        const profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
        (profiles ?? []).forEach((p) => { profileMap[p.id] = p; });

        const summary = userIds.map((uid) => ({
          user: profileMap[uid]?.full_name ?? profileMap[uid]?.email ?? uid,
          email: profileMap[uid]?.email,
          lateTaskCount: byUser[uid].length,
          tasks: byUser[uid].map((t) => ({
            title: t.title,
            due_date: t.due_date,
            status: t.status,
            priority: t.priority,
          })),
        }));

        const { data: admins } = await supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");

        const notifInserts = (admins ?? []).map((a) => ({
          user_id: a.user_id,
          type: "warning" as const,
          title: `Weekly late task report: ${rows.length} incomplete task${rows.length > 1 ? "s" : ""}`,
          message: summary
            .map((s) => `${s.user}: ${s.lateTaskCount} task${s.lateTaskCount > 1 ? "s" : ""}`)
            .join(", "),
        }));

        if (notifInserts.length) {
          await supabaseAdmin.from("notifications").insert(notifInserts);
        }

        return Response.json({
          message: "Late task report generated",
          week: `${weekStart} to ${weekEnd}`,
          totalLateTasks: rows.length,
          affectedUsers: userIds.length,
          summary,
        });
      },
      GET: async () => Response.json({ ok: true }),
    },
  },
});
