import * as React from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, CheckSquare, Users, Target, Clock, Bell, Settings,
  LogOut, ChevronLeft, ChevronRight, Star, Wallet, FolderUp, Kanban,
  Megaphone, MessageSquare, GitBranch, BookOpen, ClipboardList, RefreshCw,
  Briefcase, Sparkles, CalendarOff, Flag, BarChart3, UserCircle, CreditCard,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useFeatureFlags } from "@/lib/feature-flags";

interface NavItem {
  slug: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<"admin" | "manager" | "employee">;
  flagKey?: string;
}

const NAV: NavItem[] = [
  { slug: "dashboard",       label: "Dashboard",       icon: LayoutDashboard, roles: ["admin", "manager", "employee"] },
  { slug: "tasks",           label: "Tasks",           icon: CheckSquare,     roles: ["admin", "manager", "employee"] },
  { slug: "attendance",      label: "Attendance",      icon: Clock,           roles: ["admin", "manager", "employee"] },
  { slug: "leave",           label: "Leave",           icon: CalendarOff,     roles: ["admin", "manager", "employee"], flagKey: "leave" },
  { slug: "standups",        label: "Standups",        icon: ClipboardList,   roles: ["admin", "manager", "employee"], flagKey: "standups" },
  { slug: "deliverables",    label: "Deliverables",    icon: FolderUp,        roles: ["admin", "manager", "employee"], flagKey: "deliverables" },
  { slug: "reviews",         label: "Reviews",         icon: Star,            roles: ["admin", "manager", "employee"], flagKey: "reviews" },
  { slug: "payslips",        label: "Payslips",        icon: Wallet,          roles: ["admin", "manager", "employee"], flagKey: "payslips" },
  { slug: "announcements",   label: "Announcements",   icon: Megaphone,       roles: ["admin", "manager", "employee"], flagKey: "announcements" },
  { slug: "messages",        label: "Messages",        icon: MessageSquare,   roles: ["admin", "manager", "employee"], flagKey: "messages" },
  { slug: "handbook",        label: "Handbook",        icon: BookOpen,        roles: ["admin", "manager", "employee"], flagKey: "handbook" },
  { slug: "org-chart",       label: "Org Chart",       icon: GitBranch,       roles: ["admin", "manager", "employee"], flagKey: "org-chart" },
  { slug: "okrs",            label: "Goals & OKRs",    icon: Flag,            roles: ["admin", "manager", "employee"], flagKey: "okrs" },
  { slug: "notifications",   label: "Notifications",   icon: Bell,            roles: ["admin", "manager", "employee"] },
  { slug: "settings",        label: "Settings",        icon: Settings,        roles: ["admin", "manager", "employee"] },
  { slug: "team",            label: "Team",            icon: Users,           roles: ["admin", "manager"] },
  { slug: "team-board",      label: "Task Board",      icon: Kanban,          roles: ["admin", "manager"], flagKey: "team-board" },
  { slug: "recurring-tasks", label: "Recurring Tasks", icon: RefreshCw,       roles: ["admin", "manager"], flagKey: "recurring-tasks" },
  { slug: "client-projects", label: "Client Projects", icon: Briefcase,       roles: ["admin", "manager"], flagKey: "client-projects" },
  { slug: "reports",         label: "Reports",         icon: BarChart3,       roles: ["admin", "manager"], flagKey: "reports" },
  { slug: "ai-tasks",        label: "AI Tasks",        icon: Sparkles,        roles: ["admin", "manager"], flagKey: "ai-tasks" },
  { slug: "kpis",            label: "KPIs",            icon: Target,          roles: ["admin"], flagKey: "kpis" },
  { slug: "billing",         label: "Billing",         icon: CreditCard,      roles: ["admin"] },
  { slug: "profile",         label: "Profile",         icon: UserCircle,      roles: ["admin", "manager", "employee"] },
];

export function AppSidebar({
  workspaceSlug,
  collapsed,
  onToggle,
}: {
  workspaceSlug: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { role, profile, signOut } = useAuth();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { flags } = useFeatureFlags(workspace?.id ?? null);

  const items = (role ? NAV.filter((n) => n.roles.includes(role)) : NAV).filter(
    (n) => !n.flagKey || flags[n.flagKey] !== false || role === "admin",
  );

  const href = (slug: string) => `/${workspaceSlug}/${slug}`;
  const isActive = (slug: string) => {
    const path = href(slug);
    return pathname === path || (slug !== "dashboard" && pathname.startsWith(path));
  };

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center justify-between border-b border-border px-3">
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          to={`/${workspaceSlug}/dashboard` as any}
          className="flex items-center gap-2 px-1"
        >
          {workspace?.logo_url ? (
            <img src={workspace.logo_url} alt={workspace.name} className="h-8 w-8 rounded-lg object-cover shrink-0" />
          ) : (
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: workspace?.primary_color ?? "#3B82F6" }}
            >
              <span className="text-sm font-bold">
                {(workspace?.name ?? "N").slice(0, 1).toUpperCase()}
              </span>
            </div>
          )}
          {!collapsed && (
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-sm font-semibold truncate">{workspace?.name ?? "Nexus HQ"}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {role ?? ""}
              </span>
            </div>
          )}
        </Link>
        <button
          onClick={onToggle}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.slug);
          return (
            <Link
              key={item.slug}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              to={href(item.slug) as any}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User card */}
      <div className="border-t border-border p-2">
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg p-2",
            !collapsed && "bg-accent/40",
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {(profile?.full_name ?? profile?.email ?? "?").slice(0, 1).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile?.full_name ?? "—"}</p>
              <p className="truncate text-xs text-muted-foreground">{profile?.email ?? ""}</p>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={async () => {
                await signOut();
                navigate({ to: "/login" });
              }}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
