import * as React from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Target,
  Clock,
  Bell,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Star,
  Wallet,
  FolderUp,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<"admin" | "manager" | "employee">;
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "manager", "employee"] },
  { to: "/tasks", label: "Tasks", icon: CheckSquare, roles: ["admin", "manager", "employee"] },
  { to: "/attendance", label: "Attendance", icon: Clock, roles: ["admin", "manager", "employee"] },
  { to: "/deliverables", label: "Deliverables", icon: FolderUp, roles: ["admin", "manager", "employee"] },
  { to: "/reviews", label: "Reviews", icon: Star, roles: ["admin", "manager", "employee"] },
  { to: "/payslips", label: "Payslips", icon: Wallet, roles: ["admin", "manager", "employee"] },
  { to: "/team", label: "Team", icon: Users, roles: ["admin", "manager"] },
  { to: "/kpis", label: "KPIs", icon: Target, roles: ["admin"] },
  { to: "/notifications", label: "Notifications", icon: Bell, roles: ["admin", "manager", "employee"] },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["admin", "manager", "employee"] },
];

export function AppSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { role, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const items = role ? NAV.filter((n) => n.roles.includes(role)) : NAV;

  const isActive = (to: string) =>
    pathname === to || (to !== "/dashboard" && pathname.startsWith(to));

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      {/* Brand */}
      <div className="flex h-16 items-center justify-between border-b border-border px-3">
        <Link to="/dashboard" className="flex items-center gap-2 px-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-sm font-bold">N</span>
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold">Nexus HQ</span>
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
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
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
