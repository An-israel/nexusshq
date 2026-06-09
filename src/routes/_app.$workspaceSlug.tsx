import * as React from "react";
import {
  createFileRoute,
  Outlet,
  redirect,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { WorkspaceProvider, useWorkspace } from "@/lib/workspace-context";
import { useAuth } from "@/lib/auth-context";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { ClockWidget } from "@/components/layout/ClockWidget";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { GlobalCommandPalette, openCommandPalette } from "@/components/layout/GlobalCommandPalette";
import { WhatsNew } from "@/components/layout/WhatsNew";
import { cn } from "@/lib/utils";
import { setLastWorkspaceSlug } from "@/lib/last-workspace";
import { toast } from "sonner";

// Derives a short human-readable device label from the user-agent string.
function parseDeviceName(ua: string): string {
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  const os = /Windows/.test(ua) ? "Windows" : /Mac/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${browser} on ${os}`;
}

// Stable per-device UUID stored in localStorage
function getDeviceSessionId(): string {
  const key = "nexus_device_session_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export const Route = createFileRoute("/_app/$workspaceSlug")({
  beforeLoad: async ({ params }) => {
    // No session storage on the server (localStorage isn't available during
    // SSR), so getSession() always comes back null here — redirecting would
    // incorrectly send authenticated users back to /login on every full-page
    // load (refresh, direct link, or returning from an external redirect like
    // Paystack checkout). WorkspaceShell re-runs these checks client-side once
    // the real session is known.
    if (typeof window === "undefined") return;

    const { workspaceSlug } = params;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });

    const { data: workspace, error: wsError } = await supabase
      .from("workspaces")
      .select("id")
      .eq("slug", workspaceSlug)
      .eq("is_active", true)
      .maybeSingle();

    if (wsError || !workspace) {
      throw redirect({ to: "/login" });
    }

    const { data: membership } = await supabase
      .from("workspace_members")
      .select("id, is_active")
      .eq("workspace_id", workspace.id)
      .eq("user_id", session.user.id)
      .maybeSingle();

    // Strict tenant isolation: only actual active workspace members are let
    // through. Never fall back to legacy user_roles — that bug caused new
    // signups to be silently dumped into the first workspace in the system.
    if (!membership || membership.is_active === false) {
      throw redirect({ to: "/workspaces" });
    }
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

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function MobileClockDisplay() {
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const [now, setNow] = React.useState(() => new Date());
  const [today, setToday] = React.useState<{
    id: string;
    clock_in: string | null;
    clock_out: string | null;
  } | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = React.useCallback(async () => {
    if (!user) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("attendance")
      .select("id, clock_in, clock_out")
      .eq("user_id", user!.id)
      .eq("date", todayStr)
      .maybeSingle();
    setToday(data ?? null);
  }, [user]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const clockedIn = !!today?.clock_in && !today?.clock_out;
  const done = !!today?.clock_in && !!today?.clock_out;

  const timeStr = now.toLocaleTimeString("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Lagos",
  });

  let elapsed = "";
  if (clockedIn && today?.clock_in) {
    const ms = now.getTime() - new Date(today.clock_in).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    elapsed = `${h}h ${m}m`;
  }

  async function clockIn() {
    if (!user) return;
    setBusy(true);

    // GPS verification
    if (workspace?.enforce_gps_clockin && workspace.office_lat && workspace.office_lng) {
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 10000,
            maximumAge: 60000,
          });
        });
        const dist = haversineDistance(
          pos.coords.latitude,
          pos.coords.longitude,
          Number(workspace.office_lat),
          Number(workspace.office_lng),
        );
        if (dist > (workspace.clock_in_radius_m ?? 500)) {
          toast.error(
            `You are ${Math.round(dist)}m from the office. Clock-in requires you to be within ${workspace.clock_in_radius_m ?? 500}m.`,
          );
          setBusy(false);
          return;
        }
      } catch {
        toast.error("Could not get your location. Please allow location access to clock in.");
        setBusy(false);
        return;
      }
    }

    const nowD = new Date();
    const todayStr = nowD.toISOString().slice(0, 10);
    await supabase.from("attendance").upsert(
      {
        user_id: user!.id,
        date: todayStr,
        clock_in: nowD.toISOString(),
        status: nowD.getHours() >= 9 ? "late" : "present",
      },
      { onConflict: "user_id,date" },
    );
    if (navigator.vibrate) navigator.vibrate(50);
    await load();
    setBusy(false);
  }

  async function clockOut() {
    if (!user || !today?.clock_in || !today?.id) return;
    setBusy(true);
    const nowD = new Date();
    const minutes = Math.round((nowD.getTime() - new Date(today.clock_in).getTime()) / 60000);
    await supabase
      .from("attendance")
      .update({ clock_out: nowD.toISOString(), total_minutes: minutes })
      .eq("id", today.id);
    if (navigator.vibrate) navigator.vibrate(50);
    await load();
    setBusy(false);
  }

  return (
    <div className="flex w-full items-center">
      {/* Large time display */}
      <div className="flex-1">
        <p className="text-lg font-bold tabular-nums">
          {timeStr} <span className="text-xs font-normal text-muted-foreground">WAT</span>
        </p>
      </div>
      {/* Clock in/out */}
      <div className="flex flex-col items-end gap-0.5">
        {clockedIn && elapsed && (
          <span className="text-[10px] text-muted-foreground">{elapsed}</span>
        )}
        {done ? (
          <span className="text-xs text-muted-foreground">Done for today</span>
        ) : clockedIn ? (
          <button
            onClick={clockOut}
            disabled={busy}
            className="rounded-full bg-red-500 px-4 py-1.5 text-xs font-semibold text-white active:scale-95 transition-transform"
          >
            Clock Out
          </button>
        ) : (
          <button
            onClick={clockIn}
            disabled={busy}
            className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white active:scale-95 transition-transform"
          >
            Clock In
          </button>
        )}
      </div>
    </div>
  );
}

function WorkspaceShell() {
  const { workspaceSlug } = Route.useParams();
  const { workspace, loading, setWorkspaceData } = useWorkspace();

  React.useEffect(() => {
    if (workspaceSlug) setLastWorkspaceSlug(workspaceSlug);
  }, [workspaceSlug]);
  const { user, role, profile } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const isMessages = useRouterState({ select: (s) => s.location.pathname.includes("/messages") });
  const isDashboard = useRouterState({ select: (s) => s.location.pathname.endsWith("/dashboard") });

  React.useEffect(() => {
    if (!user) return;
    const currentUser = user;
    let active = true;

    async function load() {
      const { data: ws, error: wsError } = await supabase
        .from("workspaces")
        .select(
          "id, name, slug, logo_url, primary_color, plan, plan_seats, is_active, trial_ends_at, created_at",
        )
        .eq("slug", workspaceSlug)
        .maybeSingle();

      if (!active) return;

      // If workspaces table doesn't exist yet (migration pending), fall back to
      // user_roles and synthesise a workspace so the shell renders correctly.
      if (wsError || !ws) {
        const { data: ur } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user!.id)
          .maybeSingle();
        if (!active) return;
        if (ur) {
          const syntheticWs = {
            id: "legacy",
            name: "Skryve",
            slug: workspaceSlug,
            logo_url: null,
            primary_color: "#6366f1",
            plan: "growth" as const,
            plan_seats: 100,
            is_active: true,
            trial_ends_at: null,
            created_at: new Date().toISOString(),
          };
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setWorkspaceData(syntheticWs as any, (ur.role === "admin" ? "admin" : ur.role) as any, 0);
        } else {
          navigate({ to: "/login" });
        }
        return;
      }

      // Try workspace_members for role; fall back to user_roles for legacy users
      const { data: mem } = await supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", ws.id)
        .eq("user_id", user!.id)
        .eq("is_active", true)
        .maybeSingle();

      if (!active) return;

      let resolvedRole: string = "employee";
      if (mem) {
        resolvedRole = mem.role;
      } else {
        const { data: ur } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user!.id)
          .maybeSingle();
        if (!active) return;
        resolvedRole = ur?.role ?? "employee";
      }

      const { count } = await supabase
        .from("workspace_members")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", ws.id);
      if (!active) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setWorkspaceData(ws as any, resolvedRole as any, count ?? 0);
    }

    void load();
    return () => {
      active = false;
    };
  }, [workspaceSlug, user, setWorkspaceData, navigate]);

  // Track this device session for the "Active sessions" panel in Settings
  React.useEffect(() => {
    if (!user || !workspace?.id) return;
    const sessionId = getDeviceSessionId();
    void supabase.from("user_sessions").upsert(
      {
        user_id: user.id,
        workspace_id: workspace.id,
        session_id: sessionId,
        user_agent: navigator.userAgent,
        device_name: parseDeviceName(navigator.userAgent),
        last_active_at: new Date().toISOString(),
      },
      { onConflict: "user_id,session_id" },
    );
  }, [user?.id, workspace?.id]);

  // BUG 2: presence heartbeat — upsert every 5 min + on visibility change
  React.useEffect(() => {
    if (!user || !workspace?.id) return;

    async function upsertPresence(status: "online" | "away" | "offline") {
      await supabase.from("user_presence").upsert(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {
          user_id: user!.id,
          workspace_id: workspace!.id,
          status: status as string,
          last_seen: new Date().toISOString(),
        } as any,
        { onConflict: "user_id,workspace_id" },
      );
    }

    void upsertPresence("online");
    const interval = setInterval(
      () => {
        const status = document.visibilityState === "visible" ? "online" : "away";
        void upsertPresence(status);
      },
      5 * 60 * 1000,
    );

    function handleVisibility() {
      void upsertPresence(document.visibilityState === "visible" ? "online" : "away");
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      void upsertPresence("offline");
    };
  }, [user, workspace?.id]);

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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
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
            href="mailto:nexxoshq@gmail.com"
            className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Contact support →
          </a>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/login" });
            }}
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
        <header
          className={cn(
            "shrink-0 border-b border-border bg-background/80 backdrop-blur",
            isMessages
              ? "hidden md:flex md:h-16 md:items-center md:justify-between md:px-6"
              : "flex flex-col md:flex-row md:h-16 md:items-center md:justify-between md:px-6",
          )}
        >
          {/* ROW 1 — always visible on mobile (44px), full row on desktop */}
          <div className="flex h-11 items-center justify-between px-4 md:h-auto md:flex-1 md:px-0">
            {/* Left: workspace avatar + name */}
            <div className="flex items-center gap-2">
              {workspace.logo_url ? (
                <img
                  src={workspace.logo_url}
                  alt={workspace.name}
                  className="h-9 w-9 rounded-xl object-cover"
                />
              ) : (
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl text-white text-sm font-bold"
                  style={{ backgroundColor: workspace.primary_color ?? "#6366f1" }}
                >
                  {workspace.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <span className="text-sm font-semibold truncate max-w-[140px] md:hidden">
                {workspace.name}
              </span>
              {/* Desktop: show role · workspace */}
              <span className="hidden md:block text-xs uppercase tracking-wider text-muted-foreground">
                {role ? role.charAt(0).toUpperCase() + role.slice(1) : ""} · {workspace.name}
              </span>
            </div>

            {/* Right: search + notification bell + profile avatar */}
            <div className="flex items-center gap-2">
              <button
                onClick={openCommandPalette}
                className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                aria-label="Search (Ctrl+K)"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <span className="hidden md:inline">Search</span>
                <kbd className="hidden md:inline text-[10px] font-mono opacity-60">⌘K</kbd>
              </button>
              <NotificationBell />
              <WhatsNew />
              {/* Profile avatar — links to profile page, mobile only */}
              <a
                href={`/${workspaceSlug}/profile`}
                className="flex md:hidden h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary"
                aria-label="Profile"
              >
                {(profile?.full_name ?? profile?.email ?? "?").slice(0, 1).toUpperCase()}
              </a>
              {/* Desktop: show clock widget */}
              <div className="hidden md:block">
                <ClockWidget />
              </div>
            </div>
          </div>

          {/* ROW 2 — only visible on mobile AND only on dashboard route (48px) */}
          {isDashboard && (
            <div className="flex h-12 items-center justify-between border-t border-border/40 px-4 md:hidden">
              {/* Large clock in center */}
              <div className="flex-1">
                <MobileClockDisplay />
              </div>
            </div>
          )}
        </header>

        <main
          className={
            isMessages
              ? "flex min-h-0 flex-1 flex-col overflow-hidden"
              : "flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6"
          }
        >
          <Outlet />
        </main>
      </div>

      <MobileBottomNav workspaceSlug={workspaceSlug} />
      <GlobalCommandPalette workspaceSlug={workspaceSlug} />
    </div>
  );
}
