import * as React from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, CheckSquare, MessageSquare, Bell, Menu, Clock, Users,
  CalendarOff, Flag, BarChart3, Megaphone, Star, Wallet, BookOpen,
  GitBranch, ClipboardList, FolderUp, Kanban, RefreshCw, Briefcase,
  Target, Sparkles, Settings, LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
  Sheet, SheetContent,
} from "@/components/ui/sheet";

interface NavItem {
  slug: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Array<"admin" | "manager" | "employee">;
}

const BOTTOM_NAV: NavItem[] = [
  { slug: "dashboard",     label: "Home",     icon: LayoutDashboard, roles: ["admin", "manager", "employee"] },
  { slug: "tasks",         label: "Tasks",    icon: CheckSquare,     roles: ["admin", "manager", "employee"] },
  { slug: "messages",      label: "Messages", icon: MessageSquare,   roles: ["admin", "manager", "employee"] },
  { slug: "notifications", label: "Alerts",   icon: Bell,            roles: ["admin", "manager", "employee"] },
];

const ALL_NAV: NavItem[] = [
  { slug: "dashboard",       label: "Dashboard",      icon: LayoutDashboard, roles: ["admin", "manager", "employee"] },
  { slug: "tasks",           label: "Tasks",          icon: CheckSquare,     roles: ["admin", "manager", "employee"] },
  { slug: "attendance",      label: "Attendance",     icon: Clock,           roles: ["admin", "manager", "employee"] },
  { slug: "leave",           label: "Leave",          icon: CalendarOff,     roles: ["admin", "manager", "employee"] },
  { slug: "standups",        label: "Standups",       icon: ClipboardList,   roles: ["admin", "manager", "employee"] },
  { slug: "deliverables",    label: "Deliverables",   icon: FolderUp,        roles: ["admin", "manager", "employee"] },
  { slug: "reviews",         label: "Reviews",        icon: Star,            roles: ["admin", "manager", "employee"] },
  { slug: "payslips",        label: "Payslips",       icon: Wallet,          roles: ["admin", "manager", "employee"] },
  { slug: "announcements",   label: "Announcements",  icon: Megaphone,       roles: ["admin", "manager", "employee"] },
  { slug: "messages",        label: "Messages",       icon: MessageSquare,   roles: ["admin", "manager", "employee"] },
  { slug: "handbook",        label: "Handbook",       icon: BookOpen,        roles: ["admin", "manager", "employee"] },
  { slug: "org-chart",       label: "Org Chart",      icon: GitBranch,       roles: ["admin", "manager", "employee"] },
  { slug: "okrs",            label: "Goals & OKRs",   icon: Flag,            roles: ["admin", "manager", "employee"] },
  { slug: "notifications",   label: "Notifications",  icon: Bell,            roles: ["admin", "manager", "employee"] },
  { slug: "settings",        label: "Settings",       icon: Settings,        roles: ["admin", "manager", "employee"] },
  { slug: "team",            label: "Team",           icon: Users,           roles: ["admin", "manager"] },
  { slug: "team-board",      label: "Task Board",     icon: Kanban,          roles: ["admin", "manager"] },
  { slug: "recurring-tasks", label: "Recurring Tasks",icon: RefreshCw,       roles: ["admin", "manager"] },
  { slug: "client-projects", label: "Client Projects",icon: Briefcase,       roles: ["admin", "manager"] },
  { slug: "reports",         label: "Reports",        icon: BarChart3,       roles: ["admin", "manager"] },
  { slug: "ai-tasks",        label: "AI Tasks",       icon: Sparkles,        roles: ["admin", "manager"] },
  { slug: "kpis",            label: "KPIs",           icon: Target,          roles: ["admin"] },
];

export function MobileBottomNav({ workspaceSlug }: { workspaceSlug: string }) {
  const { role, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [moreOpen, setMoreOpen] = React.useState(false);

  const allowed = (item: NavItem) => (role ? item.roles.includes(role) : false);
  const href = (slug: string) => `/${workspaceSlug}/${slug}`;
  const isActive = (slug: string) => {
    const path = href(slug);
    return pathname === path || (slug !== "dashboard" && pathname.startsWith(path));
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch border-t border-[#1E1E1E] bg-[#111111] md:hidden"
        style={{ height: "calc(64px + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {BOTTOM_NAV.filter(allowed).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.slug);
          return (
            <Link
              key={item.slug}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              to={href(item.slug) as any}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 transition-all duration-100",
                "active:scale-95",
                active ? "text-[#3B82F6]" : "text-[#6B7280]",
              )}
            >
              <Icon className={cn("h-6 w-6", active ? "stroke-[2]" : "stroke-[1.5]")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 transition-all duration-100",
            "active:scale-95",
            moreOpen ? "text-[#3B82F6]" : "text-[#6B7280]",
          )}
        >
          <Menu className={cn("h-6 w-6", moreOpen ? "stroke-[2]" : "stroke-[1.5]")} />
          <span className="text-[10px] font-medium">More</span>
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-[24px] bg-[#1A1A1A] border-t border-[#2A2A2A] p-0"
          style={{ maxHeight: "80vh" }}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-9 rounded-full bg-[#374151]" />
          </div>

          {/* User profile section */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-[#2A2A2A]">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
              {(profile?.full_name ?? profile?.email ?? "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{profile?.full_name ?? "—"}</p>
              <p className="truncate text-xs text-[#6B7280] capitalize">{role ?? ""}</p>
            </div>
          </div>

          {/* Nav list */}
          <div className="flex flex-col gap-1 px-4 pb-4 overflow-y-auto" style={{ maxHeight: "60vh" }}>
            <div className="pt-2" />
            {ALL_NAV.filter(allowed).map((item) => {
              const Icon = item.icon;
              const active = isActive(item.slug);
              return (
                <Link
                  key={item.slug}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  to={href(item.slug) as any}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-[#1E3A5F] text-[#3B82F6]"
                      : "text-[#9CA3AF] hover:bg-[#1E1E1E] hover:text-white",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Sign out */}
          <div className="border-t border-[#2A2A2A] px-4 py-3">
            <button
              onClick={async () => {
                setMoreOpen(false);
                await signOut();
                navigate({ to: "/login" });
              }}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-red-400 hover:bg-[#1E1E1E] transition-colors"
            >
              <LogOut className="h-5 w-5" />
              Sign out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
