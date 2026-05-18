import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// Authenticated server fn: any signed-in user can trigger Skryve seeding,
// but the actual seeding runs with the service role on the server. The
// underlying RPC is locked down and only callable by service_role.
export const ensureSkryveSeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!SUPABASE_URL || !SERVICE_ROLE) {
        console.error("ensureSkryveSeed: missing SUPABASE env vars");
        return { workspaceId: null as string | null, error: "misconfigured" as const };
      }
      const admin = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (admin.rpc as any)("ensure_skryve_seed");
      if (error) {
        console.error("ensureSkryveSeed RPC error:", error.message);
        return { workspaceId: null as string | null, error: error.message };
      }
      return { workspaceId: (data as string) ?? null, error: null };
    } catch (err) {
      console.error("ensureSkryveSeed unexpected error:", err);
      return { workspaceId: null as string | null, error: "unexpected" as const };
    }
  });
