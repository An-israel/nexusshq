import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Public endpoint called by pg_cron at 16:00 UTC (= 17:00 WAT) every day.
// Auto clock-out anyone who forgot to clock out by end of day.
export const Route = createFileRoute("/api/public/cron/auto-clock-out")({
  server: {
    handlers: {
      POST: async () => {
        const today = new Date().toISOString().slice(0, 10);
        // 17:00 WAT = 16:00 UTC
        const autoOut = new Date(`${today}T16:00:00.000Z`);

        const { data: rows, error } = await supabaseAdmin
          .from("attendance")
          .select("id, clock_in")
          .eq("date", today)
          .not("clock_in", "is", null)
          .is("clock_out", null);

        if (error) return new Response(error.message, { status: 500 });

        let closed = 0;
        for (const row of rows ?? []) {
          const minutes = Math.max(
            0,
            Math.round(
              (autoOut.getTime() - new Date(row.clock_in!).getTime()) / 60000,
            ),
          );
          await supabaseAdmin
            .from("attendance")
            .update({ clock_out: autoOut.toISOString(), total_minutes: minutes })
            .eq("id", row.id);
          closed++;
        }

        return Response.json({ closed });
      },
      GET: async () => Response.json({ ok: true }),
    },
  },
});
