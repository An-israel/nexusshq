import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Called by pg_cron every Monday at 06:00 UTC (= 07:00 WAT).
// Computes last-week stats, asks Claude for a summary paragraph, and emails
// all active employees + managers.
export const Route = createFileRoute("/api/public/cron/weekly-summary-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const monday = new Date();
        monday.setDate(monday.getDate() - monday.getDay()); // this Monday
        const lastMon = new Date(monday);
        lastMon.setDate(lastMon.getDate() - 7);
        const lastSun = new Date(lastMon);
        lastSun.setDate(lastSun.getDate() + 6);

        const weekStart = lastMon.toISOString().slice(0, 10);
        const weekEnd = lastSun.toISOString().slice(0, 10);

        // ── Gather stats ───────────────────────────────────────────────────
        const [{ count: total }, { count: completed }, { count: overdue }] = await Promise.all([
          supabaseAdmin
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .gte("due_date", weekStart)
            .lte("due_date", weekEnd),
          supabaseAdmin
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("status", "completed")
            .gte("due_date", weekStart)
            .lte("due_date", weekEnd),
          supabaseAdmin
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("status", "overdue")
            .gte("due_date", weekStart)
            .lte("due_date", weekEnd),
        ]);

        // Attendance
        const { data: attRows } = await supabaseAdmin
          .from("attendance")
          .select("user_id, clock_out")
          .gte("date", weekStart)
          .lte("date", weekEnd);

        const presentSet = new Set(
          (attRows ?? []).filter((r) => r.clock_out).map((r) => r.user_id),
        );
        const presentDays = presentSet.size;

        const { count: totalEmployees } = await supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_active", true);

        const absentDays = (totalEmployees ?? 0) - presentDays;

        // Top department by completed tasks
        const { data: deptTasks } = await supabaseAdmin
          .from("tasks")
          .select("assigned_to, status")
          .eq("status", "completed")
          .gte("due_date", weekStart)
          .lte("due_date", weekEnd);

        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, department, email, full_name")
          .eq("is_active", true);

        const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
        const deptCount: Record<string, number> = {};
        for (const t of deptTasks ?? []) {
          const dept = profileMap[t.assigned_to]?.department ?? "unknown";
          deptCount[dept] = (deptCount[dept] ?? 0) + 1;
        }
        const topDept = Object.entries(deptCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "N/A";

        // ── Ask Claude for summary ─────────────────────────────────────────
        const baseUrl = new URL(request.url).origin;
        let emailBody = "";

        const aiResp = await fetch(`${baseUrl}/api/ai`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "weekly-summary",
            context: {
              stats: {
                totalTasks: total ?? 0,
                completedTasks: completed ?? 0,
                overdueTasks: overdue ?? 0,
                presentDays,
                absentDays,
                topDept,
              },
            },
          }),
        });

        if (aiResp.ok) {
          const d = (await aiResp.json()) as { result?: string };
          emailBody = d.result ?? "";
        }

        if (!emailBody) {
          emailBody = `Hi team,\n\nLast week we completed ${completed ?? 0} of ${total ?? 0} tasks. Have a great week ahead!`;
        }

        // ── Send emails via Resend HTTP API ───────────────────────────────
        const apiKey = process.env.RESEND_API_KEY;
        const recipients = (profiles ?? []).filter((p) => p.email);
        let sent = 0;

        if (apiKey) {
          for (const p of recipients) {
            try {
              const r = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  from: "Nexxos HQ <noreply@nexushq.app>",
                  to: [p.email!],
                  subject: `Nexxos HQ Weekly Summary — week of ${weekStart}`,
                  text: emailBody,
                }),
              });
              if (r.ok) sent++;
            } catch {
              // continue on individual failure
            }
          }
        }

        return Response.json({
          week: `${weekStart} to ${weekEnd}`,
          stats: { total, completed, overdue, presentDays, absentDays, topDept },
          emailsSent: sent,
        });
      },
      GET: async () => Response.json({ ok: true }),
    },
  },
});
