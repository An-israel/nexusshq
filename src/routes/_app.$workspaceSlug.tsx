import * as React from "react";
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { ClockWidget } from "@/components/layout/ClockWidget";
import { NotificationBell } from "@/components/layout/NotificationBell";

export const Route = createFileRoute("/_app/$workspaceSlug")({
  beforeLoad: async ({ params }) => {
    const { workspaceSlug } = params;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });

    const { data: workspace } = await supabase
      .from("workspaces")
      .select("id")
      .eq("slug", workspaceSlug)
      .eq("is_active", true)
      .maybeSingle();
    if (!workspace) throw redirect({ to: "/" });

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (!membership) throw redirect({ to: "/" });
  },
  component: WorkspaceRoot,
});

function WorkspaceRoot() {
  return (
    <WorkspaceProvider>
      <WorkspaceShell />
    </WorkspaceProvider>
  );
}

function WorkspaceShell() {
  const { workspaceSlug } = Route.useParams();
  const { workspace, loading, setWorkspaceData } = useWorkspace();
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  React.useEffect(() => {
    if (!user) return;
    let active = true;

    async function load() {
      const { data: ws } = await supabase
        .from("workspaces")
        .select("id, name, slug, logo_url, primary_color, plan, plan_seats, is_active, trial_ends_at, created_at")
        .eq("slug", workspaceSlug)
        .maybeSingle();
      if (!active || !ws) return;

      const { data: mem } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", ws.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active || !mem) return;

      const { count } = await supabase
        .from("workspace_members")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", ws.id);
      if (!active) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setWorkspaceData(ws as any, mem.role as any, count ?? 0);
    }

    void load();
    return () => { active = false; };
  }, [workspaceSlug, user, setWorkspaceData]);

  if (loading || !workspace) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const isTrialExpired =
    workspace.plan === "starter" &&
    workspace.trial_ends_at !== null &&
    new Date(workspace.trial_ends_at) < new Date();

  if (!workspace.is_active || isTrialExpired) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-background px-4 text-center">
        <div className="max-w-md space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold">
            {isTrialExpired ? "Your free trial has ended" : "Workspace suspended"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isTrialExpired
              ? "Upgrade to a paid plan to continue. Your data is safe and will be kept for 30 days."
              : "This workspace has been suspended. Contact support to restore access."}
          </p>
          <a
            href="mailto:support@nexushq.io"
            className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Contact support →
          </a>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); }}
            className="block text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-background text-foreground">
      {/* Sidebar — desktop only */}
      <div className="hidden md:flex">
        <AppSidebar
          workspaceSlug={workspaceSlug}
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:h-16 md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            {workspace.logo_url ? (
              <img src={workspace.logo_url} alt={workspace.name} className="h-7 w-7 rounded-lg object-cover" />
            ) : (
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white text-xs font-bold"
                style={{ backgroundColor: workspace.primary_color }}
              >
                {workspace.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="text-sm font-semibold truncate max-w-[160px]">{workspace.name}</span>
          </div>
          <div className="hidden text-xs uppercase tracking-wider text-muted-foreground md:block">
            {role ? role.charAt(0).toUpperCase() + role.slice(1) : ""} · {workspace.name}
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <ClockWidget />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>

      <MobileBottomNav workspaceSlug={workspaceSlug} />
    </div>
  );
}
