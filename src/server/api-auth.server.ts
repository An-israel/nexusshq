import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface ApiUser {
  id: string;
  email: string | null;
}

/**
 * Verifies the caller is a signed-in Supabase user before a costly /api/*
 * route handler does any work (these routes proxy to paid third-party APIs —
 * Anthropic, OpenAI Whisper, Paystack — and must not be callable anonymously).
 *
 * Returns the authenticated user, or a 401 Response to send back as-is.
 */
export async function requireApiUser(request: Request): Promise<ApiUser | Response> {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "");
  const token = match?.[1];
  if (!token) {
    return Response.json({ error: "Unauthorized: sign in to use this feature" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    return Response.json({ error: "Unauthorized: invalid or expired session" }, { status: 401 });
  }

  return { id: data.user.id, email: data.user.email ?? null };
}
