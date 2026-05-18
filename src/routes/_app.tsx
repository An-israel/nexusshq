import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { logSupabaseClientError } from "@/lib/supabase-diagnostics";
import { useAppBadge } from "@/lib/use-app-badge";

const TIMEOUT_SENTINEL = Symbol("timeout");

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<typeof TIMEOUT_SENTINEL>((resolve) =>
        setTimeout(() => resolve(TIMEOUT_SENTINEL), 1000),
      ),
    ]);
    if (result === TIMEOUT_SENTINEL) return;
    const {
      data: { session },
      error,
    } = result;
    if (error) {
      logSupabaseClientError({
        scope: "app-layout:beforeLoad:getSession",
        error,
        matchers: ["/auth/v1/session"],
        extra: { route: "/_app" },
      });
    }
    if (!session && !error) throw redirect({ to: "/login" });
  },
  pendingMs: 800,
  component: AppAuthGate,
});

function AppAuthGate() {
  const { loading, session } = useAuth();
  const navigate = useNavigate();
  useAppBadge();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!session) return null;

  return <Outlet />;
}
