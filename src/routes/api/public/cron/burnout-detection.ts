import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Called by pg_cron every Sunday at 06:00 UTC (= 07:00 WAT).
// Analyses past-4-week activity for every active employee and calls the
// /api/ai burnout-risk action.  Persists medium/high alerts to burnout_alerts.
export const Route = createFileRoute("/api/public/cron/burnout-detection")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
        if (!apiKey) {
          return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
        }

        const fourWeeksAgo = new Date();
        fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
        const since = fourWeeksAgo.toISOString().slice(0, 10);

        // Fetch all active employee profiles
        const { data: profiles, error: pErr } = await supabaseAdmin
          .from("profiles")
          .select("id, full_name, email, department")
          .eq("is_active", true);

        if (pErr) return Response.json({ error: pErr.message }, { status: 500 });

        const baseUrl = new URL(request.url).origin;
        const results: Array<{ name: string; risk_level: string; reason: string }> = [];
        let alertsInserted = 0;

        for (const profile of profiles ?? []) {
          // Attendance metrics
          const { data: attendance } = await supabaseAdmin
            .from("attendance")
            .select("clock_in, clock_out, total_minutes")
            .eq("user_id", profile.id)
            .gte("date", since);

          const rows = attendance ?? [];
          const WORK_MINUTES = 8 * 60; // 8 h standard day
          let overtimeMinutes = 0;
          let missedClockOuts = 0;
          let lateDays = 0;

          for (const a of rows) {
            if (!a.clock_out) { missedClockOuts++; continue; }
            const mins = a.total_minutes ?? 0;
            if (mins > WORK_MINUTES) overtimeMinutes += mins - WORK_MINUTES;
            // Late = clock-in after 09:30 WAT (= 08:30 UTC)
            if (a.clock_in) {
              const hour = new Date(a.clock_in).getUTCHours();
              const min = new Date(a.clock_in).getUTCMinutes();
              if (hour > 8 || (hour === 8 && min > 30)) lateDays++;
            }
          }

          // Overdue task count
          const { count: overdueTasks } = await supabaseAdmin
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("assigned_to", profile.id)
            .eq("status", "overdue");

          // Call AI burnout-risk
          const aiResp = await fetch(`${baseUrl}/api/ai`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "burnout-risk",
              context: {
                name: profile.full_name ?? profile.email ?? profile.id,
                overtimeMinutes,
                missedClockOuts,
                overdueTasks: overdueTasks ?? 0,
                lateDays,
              },
            }),
          });

          if (!aiResp.ok) continue;

          const aiData = (await aiResp.json()) as { result?: string };
          let parsed: { risk_level: string; reason: string } | null = null;
          try {
            parsed = JSON.parse(aiData.result ?? "");
          } catch {
            // skip malformed AI response
          }
          if (!parsed || parsed.risk_level === "low") continue;

          results.push({ name: profile.full_name ?? profile.id, ...parsed });

          // Persist alert
          await supabaseAdmin.from("burnout_alerts").insert({
            user_id: profile.id,
            risk_level: parsed.risk_level,
            reason: parsed.reason,
          });
          alertsInserted++;

          // Notify admins
          const { data: admins } = await supabaseAdmin
            .from("user_roles")
            .select("user_id")
            .eq("role", "admin");

          const notifs = (admins ?? []).map((a) => ({
            user_id: a.user_id,
            type: "warning" as const,
            title: `Burnout risk detected: ${profile.full_name ?? profile.email}`,
            message: `Risk level: ${parsed!.risk_level}. ${parsed!.reason}`,
          }));
          if (notifs.length) await supabaseAdmin.from("notifications").insert(notifs);
        }

        return Response.json({ alertsInserted, details: results });
      },
      GET: async () => Response.json({ ok: true }),
    },
  },
});
