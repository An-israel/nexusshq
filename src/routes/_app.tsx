import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ClockWidget } from "@/components/layout/ClockWidget";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { logSupabaseClientError } from "@/lib/supabase-diagnostics";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      logSupabaseClientError({
        scope: "app-layout:beforeLoad:getUser",
        error,
        matchers: ["/auth/v1/user"],
        extra: {
          route: "/_app",
        },
      });
    }

    const isTransientAuthError =
      !!error && /unexpected failure|database error querying schema|please check server logs/i.test(error.message);

    if (!user && !isTransientAuthError) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

function AppLayout() {
  const { loading, session, role } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

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
