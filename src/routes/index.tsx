import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

const TIMEOUT_SENTINEL = Symbol("timeout");

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    // getSession() can make a network call on token refresh — cap it at 3s
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<typeof TIMEOUT_SENTINEL>((resolve) =>
        setTimeout(() => resolve(TIMEOUT_SENTINEL), 3000),
      ),
    ]);
    if (result === TIMEOUT_SENTINEL) throw redirect({ to: "/login" });
    if (result.data.session) throw redirect({ to: "/dashboard" });
    throw redirect({ to: "/login" });
  },
  component: () => null,
});
