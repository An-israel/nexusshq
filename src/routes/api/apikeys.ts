import { randomBytes, createHash } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { requireApiUser } from "@/server/api-auth.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Resolves the workspace the authenticated user administers.
// Returns the workspaceId or a Response if not found / not admin.
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

export const Route = createFileRoute("/api/apikeys")({
  server: {
    handlers: {
      // List API keys for the workspace (no plaintext — masked only)
      GET: async ({ request }) => {
        const user = await requireApiUser(request);
        if (user instanceof Response) return user;

        const slug = new URL(request.url).searchParams.get("workspace");
        if (!slug) return Response.json({ error: "workspace param required" }, { status: 400 });

        const wsId = await resolveAdminWorkspace(user.id, slug);
        if (wsId instanceof Response) return wsId;

        const { data } = await supabaseAdmin
          .from("api_keys")
          .select("id, name, key_prefix, scopes, is_active, last_used_at, expires_at, created_at")
          .eq("workspace_id", wsId)
          .order("created_at", { ascending: false });

        return Response.json({ keys: data ?? [] });
      },

      // Create a new API key — returns the plaintext key ONCE
      POST: async ({ request }) => {
        const user = await requireApiUser(request);
        if (user instanceof Response) return user;

        let body: { workspace: string; name: string; scopes?: string[]; expiresAt?: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        if (!body.workspace || !body.name?.trim()) {
          return Response.json({ error: "workspace and name are required" }, { status: 400 });
        }

        const wsId = await resolveAdminWorkspace(user.id, body.workspace);
        if (wsId instanceof Response) return wsId;

        const plaintext = `nhq_${randomBytes(20).toString("hex")}`;
        const hash = createHash("sha256").update(plaintext).digest("hex");
        const prefix = plaintext.slice(0, 12);

        const { data: created, error } = await supabaseAdmin
          .from("api_keys")
          .insert({
            workspace_id: wsId,
            name: body.name.trim(),
            key_hash: hash,
            key_prefix: prefix,
            scopes: body.scopes ?? [],
            created_by: user.id,
            expires_at: body.expiresAt ?? null,
          })
          .select("id, name, key_prefix, scopes, is_active, created_at")
          .single();

        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ key: { ...created, plaintext } }, { status: 201 });
      },
    },
  },
});
