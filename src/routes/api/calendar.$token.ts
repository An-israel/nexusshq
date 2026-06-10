import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyCalendarToken } from "@/routes/api/calendar";

// Strip .ics suffix from the token path param (browsers may append it)
function cleanToken(raw: string): string {
  return raw.endsWith(".ics") ? raw.slice(0, -4) : raw;
}

function icsDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD
  return dateStr.replace(/-/g, "");
}

function icsDateTime(isoStr: string): string {
  return isoStr
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")
    .replace("Z", "Z");
}

function escapeIcs(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

// GET /api/calendar/:token(.ics) — returns iCal feed for the authenticated user's
// tasks and leave requests. Protected by a stateless HMAC token (see /api/calendar).
export const Route = createFileRoute("/api/calendar/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const secret = process.env.CALENDAR_SECRET;
        if (!secret) {
          return new Response("Calendar feature not configured", { status: 503 });
        }

        const userId = verifyCalendarToken(cleanToken(params.token), secret);
        if (!userId) {
          return new Response("Invalid or expired calendar token", { status: 401 });
        }

        const now = new Date();
        const stamp = icsDateTime(now.toISOString());

        const [{ data: tasks }, { data: leaves }] = await Promise.all([
          supabaseAdmin
            .from("tasks")
            .select("id, title, description, due_date, status, priority")
            .eq("assigned_to", userId)
            .neq("status", "completed")
            .order("due_date"),
          supabaseAdmin
            .from("leave_requests")
            .select("id, start_date, end_date, reason, status, leave_type_id")
            .eq("user_id", userId)
            .in("status", ["approved", "pending"])
            .order("start_date"),
        ]);

        const events: string[] = [];

        for (const task of tasks ?? []) {
          const dtStart = icsDate(task.due_date);
          // All-day event ends the next day in iCal
          const dtEnd = icsDate(
            new Date(new Date(task.due_date).getTime() + 86_400_000).toISOString().slice(0, 10),
          );
          events.push(
            [
              "BEGIN:VEVENT",
              `UID:task-${task.id}@nexushq`,
              `DTSTAMP:${stamp}`,
              `DTSTART;VALUE=DATE:${dtStart}`,
              `DTEND;VALUE=DATE:${dtEnd}`,
              `SUMMARY:${escapeIcs(`[${task.priority.toUpperCase()}] ${task.title}`)}`,
              task.description ? `DESCRIPTION:${escapeIcs(task.description)}` : null,
              `STATUS:${task.status === "in_progress" ? "IN-PROCESS" : "NEEDS-ACTION"}`,
              "END:VEVENT",
            ]
              .filter(Boolean)
              .join("\r\n"),
          );
        }

        for (const leave of leaves ?? []) {
          const dtStart = icsDate(leave.start_date);
          const dtEnd = icsDate(
            new Date(new Date(leave.end_date).getTime() + 86_400_000).toISOString().slice(0, 10),
          );
          const statusLabel = leave.status === "approved" ? "Leave" : "Leave (pending)";
          events.push(
            [
              "BEGIN:VEVENT",
              `UID:leave-${leave.id}@nexushq`,
              `DTSTAMP:${stamp}`,
              `DTSTART;VALUE=DATE:${dtStart}`,
              `DTEND;VALUE=DATE:${dtEnd}`,
              `SUMMARY:${escapeIcs(statusLabel)}`,
              leave.reason ? `DESCRIPTION:${escapeIcs(leave.reason)}` : null,
              "TRANSP:TRANSPARENT",
              "END:VEVENT",
            ]
              .filter(Boolean)
              .join("\r\n"),
          );
        }

        const cal = [
          "BEGIN:VCALENDAR",
          "VERSION:2.0",
          "PRODID:-//Nexxos HQ//Tasks & Leave//EN",
          "X-WR-CALNAME:Nexxos HQ",
          "X-WR-TIMEZONE:UTC",
          "CALSCALE:GREGORIAN",
          "METHOD:PUBLISH",
          ...events,
          "END:VCALENDAR",
        ].join("\r\n");

        return new Response(cal, {
          headers: {
            "Content-Type": "text/calendar; charset=utf-8",
            "Content-Disposition": 'attachment; filename="nexushq.ics"',
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
