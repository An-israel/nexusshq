import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireApiUser } from "@/server/api-auth.server";
import { checkRateLimit, tooManyRequests, clientKey } from "@/server/rate-limit.server";

export const Route = createFileRoute("/api/gdpr/export")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userOrError = await requireApiUser(request);
        if (userOrError instanceof Response) return userOrError;
        const user = userOrError;

        const key = clientKey(request, "gdpr-export", user.id);
        const rl = checkRateLimit(key, 3, 60 * 60 * 1000); // 3 exports per hour
        if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

        const uid = user.id;

        const [
          { data: profile },
          { data: attendance },
          { data: tasks },
          { data: messages },
          { data: notifications },
          { data: standups },
          { data: leaveRequests },
          { data: payslips },
          { data: announcements },
        ] = await Promise.all([
          supabaseAdmin.from("profiles").select("*").eq("id", uid).single(),
          supabaseAdmin.from("attendance").select("*").eq("user_id", uid).order("date"),
          supabaseAdmin.from("tasks").select("*").eq("assigned_to", uid).order("created_at"),
          supabaseAdmin
            .from("messages")
            .select("id, content, created_at, channel_id, has_attachments")
            .eq("sender_id", uid)
            .order("created_at"),
          supabaseAdmin
            .from("notifications")
            .select("id, type, title, message, is_read, created_at")
            .eq("user_id", uid)
            .order("created_at"),
          supabaseAdmin.from("standups").select("*").eq("user_id", uid).order("submitted_at"),
          supabaseAdmin.from("leave_requests").select("*").eq("user_id", uid).order("created_at"),
          supabaseAdmin
            .from("payslips")
            .select("*")
            .eq("user_id", uid)
            .order("period_year")
            .order("period_month"),
          supabaseAdmin
            .from("announcements")
            .select("id, title, body, created_at, department")
            .eq("author_id", uid)
            .order("created_at"),
        ]);

        const exportData = {
          exported_at: new Date().toISOString(),
          profile,
          attendance: attendance ?? [],
          tasks: tasks ?? [],
          messages: messages ?? [],
          notifications: notifications ?? [],
          standups: standups ?? [],
          leave_requests: leaveRequests ?? [],
          payslips: payslips ?? [],
          announcements_authored: announcements ?? [],
        };

        const json = JSON.stringify(exportData, null, 2);
        return new Response(json, {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Content-Disposition": `attachment; filename="nexus-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
          },
        });
      },
    },
  },
});
