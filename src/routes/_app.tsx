import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ClockWidget } from "@/components/layout/ClockWidget";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { logSupabaseClientError } from "@/lib/supabase-diagnostics";

const TIMEOUT_SENTINEL = Symbol("timeout");

export const Route = createFileRoute("/_app")({
  // Race getUser() against a 4s timeout so a slow/stalled Supabase connection
  // never leaves the router stuck in its pending state on mobile networks.
  // If we time out, AuthProvider takes over auth-checking on the client side.
  beforeLoad: async () => {
    const result = await Promise.race([
      supabase.auth.getUser(),
      new Promise<typeof TIMEOUT_SENTINEL>((resolve) =>
        setTimeout(() => resolve(TIMEOUT_SENTINEL), 4000),
      ),
    ]);

    if (result === TIMEOUT_SENTINEL) return; // let AuthProvider handle it

    const { data: { user }, error } = result;

    if (error) {
      logSupabaseClientError({
        scope: "app-layout:beforeLoad:getUser",
        error,
        matchers: ["/auth/v1/user"],
        extra: { route: "/_app" },
      });
    }

    const isTransientAuthError =
      !!error &&
      /unexpected failure|database error querying schema|please check server logs/i.test(
        error.message,
      );

    if (!user && !isTransientAuthError) throw redirect({ to: "/login" });
  },
  // Show a styled spinner while beforeLoad runs so there's never a blank screen
  pendingMs: 0,
  pendingComponent: LoadingScreen,
  component: AppLayout,
});

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

function AppLayout() {
  const { loading, session, role } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (loading) return <LoadingScreen />;

  // Not loading but no session — redirect effect fires, render nothing in the meantime
  if (!session) return null;

  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed((v) => !v)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {role ? role.charAt(0).toUpperCase() + role.slice(1) : ""} workspace
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ClockWidget />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
