import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Public endpoint called by pg_cron at 15:15 UTC weekdays.
// Notifies anyone clocked in but not out for today.
export const Route = createFileRoute("/api/public/cron/clock-reminder")({
  server: {
    handlers: {
      POST: async () => {
        const today = new Date().toISOString().slice(0, 10);
        const { data: rows, error } = await supabaseAdmin
          .from("attendance")
          .select("user_id")
          .eq("date", today)
          .not("clock_in", "is", null)
          .is("clock_out", null);
        if (error) return new Response(error.message, { status: 500 });
        const inserts = (rows ?? []).map((r) => ({
          user_id: r.user_id,
          type: "clock_reminder" as const,
          title: "🕓 Don't forget to clock out!",
          message: "Your shift is ending — please clock out for today.",
        }));
        if (inserts.length) {
          await supabaseAdmin.from("notifications").insert(inserts);
        }
        return Response.json({ notified: inserts.length });
      },
      GET: async () => Response.json({ ok: true }),
    },
  },
});
