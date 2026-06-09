import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface ApiKeyContext {
  workspaceId: string;
  keyId: string;
}

// Validates an API key sent in X-API-Key or Authorization: Bearer nhq_...
// Returns { workspaceId, keyId } on success, or a 401/403 Response on failure.
export async function requireApiKey(request: Request): Promise<ApiKeyContext | Response> {
  const raw =
    request.headers.get("x-api-key") ??
    (/^Bearer\s+(nhq_.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1] ?? null);

  if (!raw) {
    return Response.json({ error: "Missing API key" }, { status: 401 });
  }

  const hash = createHash("sha256").update(raw).digest("hex");

  const { data: key } = await supabaseAdmin
    .from("api_keys")
    .select("id, workspace_id, is_active, expires_at")
    .eq("key_hash", hash)
    .maybeSingle();

  if (!key || !key.is_active) {
    return Response.json({ error: "Invalid or revoked API key" }, { status: 401 });
  }
  if (key.expires_at && new Date(key.expires_at) < new Date()) {
    return Response.json({ error: "API key expired" }, { status: 401 });
  }

  // Fire-and-forget last_used_at stamp
  void supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);

  return { workspaceId: key.workspace_id, keyId: key.id };
}
