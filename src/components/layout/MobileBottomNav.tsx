import * as React from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CheckSquare,
  MessageSquare,
  Bell,
  Menu,
  Clock,
  Users,
  CalendarOff,
  Flag,
  BarChart3,
  Megaphone,
  Star,
  Wallet,
  BookOpen,
  GitBranch,
  ClipboardList,
  FolderUp,
  Kanban,
  RefreshCw,
  Briefcase,
  Target,
  Sparkles,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<"admin" | "manager" | "employee">;
}

// Items shown in the bottom bar (most-used 4 + "More")
const BOTTOM_NAV: NavItem[] = [
  { to: "/dashboard",    label: "Home",     icon: LayoutDashboard, roles: ["admin", "manager", "employee"] },
  { to: "/tasks",        label: "Tasks",    icon: CheckSquare,     roles: ["admin", "manager", "employee"] },
  { to: "/messages",     label: "Messages", icon: MessageSquare,   roles: ["admin", "manager", "employee"] },
  { to: "/notifications",label: "Alerts",   icon: Bell,            roles: ["admin", "manager", "employee"] },
];

// Full nav shown inside the "More" sheet
const ALL_NAV: NavItem[] = [
  { to: "/dashboard",       label: "Dashboard",      icon: LayoutDashboard, roles: ["admin", "manager", "employee"] },
  { to: "/tasks",           label: "Tasks",          icon: CheckSquare,     roles: ["admin", "manager", "employee"] },
  { to: "/attendance",      label: "Attendance",     icon: Clock,           roles: ["admin", "manager", "employee"] },
  { to: "/leave",           label: "Leave",          icon: CalendarOff,     roles: ["admin", "manager", "employee"] },
  { to: "/standups",        label: "Standups",       icon: ClipboardList,   roles: ["admin", "manager", "employee"] },
  { to: "/deliverables",    label: "Deliverables",   icon: FolderUp,        roles: ["admin", "manager", "employee"] },
  { to: "/reviews",         label: "Reviews",        icon: Star,            roles: ["admin", "manager", "employee"] },
  { to: "/payslips",        label: "Payslips",       icon: Wallet,          roles: ["admin", "manager", "employee"] },
  { to: "/announcements",   label: "Announcements",  icon: Megaphone,       roles: ["admin", "manager", "employee"] },
  { to: "/messages",        label: "Messages",       icon: MessageSquare,   roles: ["admin", "manager", "employee"] },
  { to: "/handbook",        label: "Handbook",       icon: BookOpen,        roles: ["admin", "manager", "employee"] },
  { to: "/org-chart",       label: "Org Chart",      icon: GitBranch,       roles: ["admin", "manager", "employee"] },
  { to: "/okrs",            label: "Goals & OKRs",   icon: Flag,            roles: ["admin", "manager", "employee"] },
  { to: "/notifications",   label: "Notifications",  icon: Bell,            roles: ["admin", "manager", "employee"] },
  { to: "/settings",        label: "Settings",       icon: Settings,        roles: ["admin", "manager", "employee"] },
  { to: "/team",            label: "Team",           icon: Users,           roles: ["admin", "manager"] },
  { to: "/team-board",      label: "Task Board",     icon: Kanban,          roles: ["admin", "manager"] },
  { to: "/recurring-tasks", label: "Recurring Tasks",icon: RefreshCw,       roles: ["admin", "manager"] },
  { to: "/client-projects", label: "Client Projects",icon: Briefcase,       roles: ["admin", "manager"] },
  { to: "/reports",         label: "Reports",        icon: BarChart3,       roles: ["admin", "manager"] },
  { to: "/ai-tasks",        label: "AI Tasks",       icon: Sparkles,        roles: ["admin", "manager"] },
  { to: "/kpis",            label: "KPIs",           icon: Target,          roles: ["admin"] },
];

export function MobileBottomNav() {
  const { role, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = React.useState(false);

  const allowed = (item: NavItem) => role ? item.roles.includes(role) : false;

  const isActive = (to: string) =>
    pathname === to || (to !== "/dashboard" && pathname.startsWith(to));

  return (
    <>
      {/* Bottom bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-16 items-stretch border-t border-border bg-background/95 backdrop-blur md:hidden">
        {BOTTOM_NAV.filter(allowed).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* More button */}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Menu className="h-5 w-5" />
          <span>More</span>
        </button>
      </nav>

      {/* More sheet */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl overflow-y-auto pb-safe">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center gap-2 text-base">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">N</div>
              Nexus HQ
            </SheetTitle>
          </SheetHeader>

          {/* User info */}
          <div className="mb-4 flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
              {(profile?.full_name ?? profile?.email ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{profile?.full_name ?? "—"}</p>
              <p className="truncate text-xs text-muted-foreground capitalize">{role ?? ""}</p>
            </div>
          </div>

          {/* Full nav grid */}
          <div className="grid grid-cols-3 gap-2">
            {ALL_NAV.filter(allowed).map((item) => {
              const Icon = item.icon;
              const active = isActive(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl p-3 text-xs font-medium transition-colors",
                    active
                      ? "bg-primary/15 text-primary"
                      : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-center leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Sign out */}
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/login" });
            }}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </SheetContent>
      </Sheet>
    </>
  );
}
