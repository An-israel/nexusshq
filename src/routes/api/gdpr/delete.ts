import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireApiUser } from "@/server/api-auth.server";

export const Route = createFileRoute("/api/gdpr/delete")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const userOrError = await requireApiUser(request);
        if (userOrError instanceof Response) return userOrError;
        const user = userOrError;

        const uid = user.id;

        // Anonymise profile — zero out PII, mark inactive.
        // Hard data (tasks, attendance) is retained for workspace audit integrity;
        // the profile row itself becomes unattributable.
        const { error: profileErr } = await supabaseAdmin
          .from("profiles")
          .update({
            full_name: "Deleted User",
            email: null,
            avatar_url: null,
            job_title: null,
            hire_date: null,
            is_active: false,
            whatsapp_opt_in: false,
          })
          .eq("id", uid);

        if (profileErr) {
          return Response.json({ error: profileErr.message }, { status: 500 });
        }

        // Delete the Supabase Auth account — this also invalidates all sessions.
        const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(uid);
        if (authErr) {
          return Response.json({ error: authErr.message }, { status: 500 });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
