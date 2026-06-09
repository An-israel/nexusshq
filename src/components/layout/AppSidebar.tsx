import * as React from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  Clock,
  Bell,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Star,
  Kanban,
  Megaphone,
  GitBranch,
  ClipboardList,
  RefreshCw,
  Briefcase,
  Flag,
  BarChart3,
  UserCircle,
  CreditCard,
  Brain,
  Radio,
  Building2,
  Check,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
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

interface NavGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      {
        slug: "dashboard",
        label: "Overview",
        icon: LayoutDashboard,
        roles: ["admin", "manager", "employee"],
      },
      {
        slug: "announcements",
        label: "Announcements",
        icon: Megaphone,
        roles: ["admin", "manager", "employee"],
        flagKey: "announcements",
      },
      {
        slug: "notifications",
        label: "Notifications",
        icon: Bell,
        roles: ["admin", "manager", "employee"],
      },
      {
        slug: "standups",
        label: "Standups",
        icon: ClipboardList,
        roles: ["admin", "manager", "employee"],
        flagKey: "standups",
      },
    ],
  },
  {
    id: "work",
    label: "Work",
    icon: CheckSquare,
    items: [
      {
        slug: "tasks",
        label: "Tasks",
        icon: CheckSquare,
        roles: ["admin", "manager", "employee"],
      },
      {
        slug: "team-board",
        label: "Task Board",
        icon: Kanban,
        roles: ["admin", "manager"],
        flagKey: "team-board",
      },
      {
        slug: "recurring-tasks",
        label: "Recurring Tasks",
        icon: RefreshCw,
        roles: ["admin", "manager"],
        flagKey: "recurring-tasks",
      },
      {
        slug: "client-projects",
        label: "Client Projects",
        icon: Briefcase,
        roles: ["admin", "manager"],
        flagKey: "client-projects",
      },
      {
        slug: "reviews",
        label: "Reviews",
        icon: Star,
        roles: ["admin", "manager", "employee"],
        flagKey: "reviews",
      },
    ],
  },
  {
    id: "team",
    label: "Team",
    icon: Users,
    items: [
      {
        slug: "team",
        label: "Members",
        icon: Users,
        roles: ["admin", "manager"],
      },
      {
        slug: "org-chart",
        label: "Org Chart",
        icon: GitBranch,
        roles: ["admin", "manager", "employee"],
        flagKey: "org-chart",
      },
      {
        slug: "live",
        label: "Live",
        icon: Radio,
        roles: ["admin", "manager"],
      },
      {
        slug: "attendance",
        label: "Attendance",
        icon: Clock,
        roles: ["admin", "manager", "employee"],
      },
    ],
  },
  {
    id: "performance",
    label: "Performance",
    icon: BarChart3,
    items: [
      {
        slug: "reports",
        label: "Reports",
        icon: BarChart3,
        roles: ["admin", "manager"],
        flagKey: "reports",
      },
      {
        slug: "okrs",
        label: "Goals & KPIs",
        icon: Flag,
        roles: ["admin", "manager", "employee"],
        flagKey: "okrs",
      },
      {
        slug: "burnout",
        label: "Wellbeing",
        icon: Brain,
        roles: ["admin", "manager"],
      },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    items: [
      {
        slug: "settings",
        label: "Settings",
        icon: Settings,
        roles: ["admin", "manager", "employee"],
      },
      {
        slug: "profile",
        label: "Profile",
        icon: UserCircle,
        roles: ["admin", "manager", "employee"],
      },
      {
        slug: "billing",
        label: "Billing",
        icon: CreditCard,
        roles: ["admin"],
      },
    ],
  },
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
  const { role, profile, signOut, user } = useAuth();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [userWorkspaces, setUserWorkspaces] = React.useState<
    {
      id: string;
      name: string;
      slug: string;
      logo_url: string | null;
      primary_color: string | null;
    }[]
  >([]);

  React.useEffect(() => {
    if (!user?.id) return;
    void supabase
      .from("workspace_members")
      .select("workspace:workspaces(id,name,slug,logo_url,primary_color)")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const ws = (data ?? [])
          .map(
            (r) =>
              (
                r as {
                  workspace: {
                    id: string;
                    name: string;
                    slug: string;
                    logo_url: string | null;
                    primary_color: string | null;
                  } | null;
                }
              ).workspace,
          )
          .filter(Boolean) as {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          primary_color: string | null;
        }[];
        setUserWorkspaces(ws);
      });
  }, [user?.id]);

  const { flags } = useFeatureFlags(workspace?.id ?? null);

  const href = (slug: string) => `/${workspaceSlug}/${slug}`;
  const isActive = (slug: string) => {
    const path = href(slug);
    return pathname === path || (slug !== "dashboard" && pathname.startsWith(path));
  };

  // Filter each group's items by role and feature flags, then drop empty groups
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        (!role || item.roles.includes(role)) &&
        (!item.flagKey || flags[item.flagKey] !== false || role === "admin"),
    ),
  })).filter((group) => group.items.length > 0);

  // Which group contains the currently active route
  const activeGroupId = React.useMemo(() => {
    for (const group of visibleGroups) {
      if (group.items.some((item) => isActive(item.slug))) return group.id;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(
    () => new Set(activeGroupId ? [activeGroupId] : ["dashboard"]),
  );

  // Auto-expand when navigating to a new group
  React.useEffect(() => {
    if (activeGroupId) {
      setExpandedGroups((prev) => {
        if (prev.has(activeGroupId)) return prev;
        return new Set([...prev, activeGroupId]);
      });
    }
  }, [activeGroupId]);

  function toggleGroup(id: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

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
            <img
              src={workspace.logo_url}
              alt={workspace.name}
              className="h-8 w-8 rounded-lg object-cover shrink-0"
            />
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
              <span className="text-sm font-semibold truncate">
                {workspace?.name ?? "Nexxos HQ"}
              </span>
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
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
        {visibleGroups.map((group) => {
          const GroupIcon = group.icon;
          const groupHasActive = group.items.some((item) => isActive(item.slug));
          const isExpanded = expandedGroups.has(group.id);

          if (collapsed) {
            // Collapsed: icon button → flyout dropdown to the right
            return (
              <DropdownMenu key={group.id}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "flex w-full items-center justify-center rounded-lg p-2.5 transition-colors",
                      groupHasActive
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                    title={group.label}
                  >
                    <GroupIcon className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="w-48">
                  <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    {group.label}
                  </p>
                  <DropdownMenuSeparator />
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const active = isActive(item.slug);
                    return (
                      <DropdownMenuItem key={item.slug} asChild>
                        <Link
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          to={href(item.slug) as any}
                          className={cn(
                            "flex cursor-pointer items-center gap-2",
                            active && "text-primary",
                          )}
                        >
                          <ItemIcon className="h-4 w-4 shrink-0" />
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          }

          // Expanded sidebar: collapsible group with sub-items
          return (
            <div key={group.id}>
              <button
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  groupHasActive
                    ? "text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <GroupIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left font-medium">{group.label}</span>
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 transition-transform duration-150",
                    isExpanded && "rotate-90",
                  )}
                />
              </button>

              {isExpanded && (
                <div className="mb-1 ml-3 mt-0.5 space-y-0.5 border-l border-border pl-3">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const active = isActive(item.slug);
                    return (
                      <Link
                        key={item.slug}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        to={href(item.slug) as any}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors",
                          active
                            ? "bg-primary/15 text-primary"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground",
                        )}
                      >
                        <ItemIcon className="h-3.5 w-3.5 shrink-0" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* User card */}
      <div className="border-t border-border p-2">
        {!collapsed && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="mb-2 w-full justify-between">
                <span className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span className="truncate">Switch workspace</span>
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              {userWorkspaces.map((ws) => (
                <DropdownMenuItem
                  key={ws.id}
                  className="flex items-center justify-between gap-2 cursor-pointer"
                  onClick={() => {
                    localStorage.setItem("nexus_active_workspace", ws.slug);
                    window.location.href = `/${ws.slug}/dashboard`;
                  }}
                >
                  <span className="truncate">{ws.name}</span>
                  {ws.slug === workspaceSlug && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
              {userWorkspaces.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => navigate({ to: "/workspaces" })}
              >
                All workspaces…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <div className={cn("flex items-center gap-2 rounded-lg p-2", !collapsed && "bg-accent/40")}>
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
