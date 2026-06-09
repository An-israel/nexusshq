import { randomBytes } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { requireApiUser } from "@/server/api-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Supported event types that can be subscribed to
export const WEBHOOK_EVENTS = [
  "task.created",
  "task.completed",
  "standup.submitted",
  "member.joined",
  "attendance.clock_in",
  "attendance.clock_out",
  "subscription.payment_failed",
  "subscription.cancelled",
] as const;

async function resolveAdminWorkspace(userId: string, slug: string): Promise<string | Response> {
  const { data: ws } = await supabaseAdmin
    .from("workspaces")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!ws) return Response.json({ error: "Workspace not found" }, { status: 404 });

  const { data: mem } = await supabaseAdmin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", ws.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!mem || !["owner", "admin"].includes(mem.role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return ws.id;
}

export const Route = createFileRoute("/api/webhooks")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await requireApiUser(request);
        if (user instanceof Response) return user;

        const slug = new URL(request.url).searchParams.get("workspace");
        if (!slug) return Response.json({ error: "workspace param required" }, { status: 400 });

        const wsId = await resolveAdminWorkspace(user.id, slug);
        if (wsId instanceof Response) return wsId;

        const { data } = await supabaseAdmin
          .from("webhook_endpoints")
          .select("id, name, url, events, is_active, last_fired_at, last_error, created_at")
          .eq("workspace_id", wsId)
          .order("created_at", { ascending: false });

        return Response.json({ endpoints: data ?? [], events: WEBHOOK_EVENTS });
      },

      POST: async ({ request }) => {
        const user = await requireApiUser(request);
        if (user instanceof Response) return user;

        let body: { workspace: string; name: string; url: string; events: string[] };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        if (!body.workspace || !body.name?.trim() || !body.url?.trim() || !body.events?.length) {
          return Response.json(
            { error: "workspace, name, url, and events are required" },
            { status: 400 },
          );
        }

        try {
          new URL(body.url);
        } catch {
          return Response.json({ error: "Invalid URL" }, { status: 400 });
        }

        const wsId = await resolveAdminWorkspace(user.id, body.workspace);
        if (wsId instanceof Response) return wsId;

        const secret = randomBytes(24).toString("hex");
        const { data: created, error } = await supabaseAdmin
          .from("webhook_endpoints")
          .insert({
            workspace_id: wsId,
            name: body.name.trim(),
            url: body.url.trim(),
            events: body.events,
            secret,
            created_by: user.id,
          })
          .select("id, name, url, events, is_active, created_at, secret")
          .single();

        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ endpoint: created }, { status: 201 });
      },
    },
  },
});
