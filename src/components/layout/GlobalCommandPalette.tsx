import * as React from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  CheckSquare,
  Clock,
  Users,
  ClipboardList,
  Star,
  Megaphone,
  MessageSquare,
  GitBranch,
  Flag,
  Bell,
  Settings,
  Kanban,
  RefreshCw,
  Briefcase,
  Radio,
  BarChart3,
  Brain,
  UserCircle,
  Building2,
  Search,
  LogIn,
  LogOut,
} from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { todayISO } from "@/lib/nexus";

interface CommandPaletteProps {
  workspaceSlug: string;
}

interface NavEntry {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  slug: string;
  roles: Array<"admin" | "manager" | "employee">;
}

const NAV_ENTRIES: NavEntry[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    slug: "dashboard",
    roles: ["admin", "manager", "employee"],
  },
  { label: "Tasks", icon: CheckSquare, slug: "tasks", roles: ["admin", "manager", "employee"] },
  { label: "Attendance", icon: Clock, slug: "attendance", roles: ["admin", "manager", "employee"] },
  {
    label: "Standups",
    icon: ClipboardList,
    slug: "standups",
    roles: ["admin", "manager", "employee"],
  },
  { label: "Reviews", icon: Star, slug: "reviews", roles: ["admin", "manager", "employee"] },
  {
    label: "Announcements",
    icon: Megaphone,
    slug: "announcements",
    roles: ["admin", "manager", "employee"],
  },
  {
    label: "Messages",
    icon: MessageSquare,
    slug: "messages",
    roles: ["admin", "manager", "employee"],
  },
  {
    label: "Org Chart",
    icon: GitBranch,
    slug: "org-chart",
    roles: ["admin", "manager", "employee"],
  },
  { label: "Goals & KPIs", icon: Flag, slug: "okrs", roles: ["admin", "manager", "employee"] },
  {
    label: "Notifications",
    icon: Bell,
    slug: "notifications",
    roles: ["admin", "manager", "employee"],
  },
  { label: "Settings", icon: Settings, slug: "settings", roles: ["admin", "manager", "employee"] },
  { label: "Profile", icon: UserCircle, slug: "profile", roles: ["admin", "manager", "employee"] },
  { label: "Team", icon: Users, slug: "team", roles: ["admin", "manager"] },
  { label: "Task Board", icon: Kanban, slug: "team-board", roles: ["admin", "manager"] },
  {
    label: "Recurring Tasks",
    icon: RefreshCw,
    slug: "recurring-tasks",
    roles: ["admin", "manager"],
  },
  {
    label: "Client Projects",
    icon: Briefcase,
    slug: "client-projects",
    roles: ["admin", "manager"],
  },
  { label: "Live", icon: Radio, slug: "live", roles: ["admin", "manager"] },
  { label: "Reports", icon: BarChart3, slug: "reports", roles: ["admin", "manager"] },
  { label: "Wellbeing", icon: Brain, slug: "burnout", roles: ["admin", "manager"] },
];

// Global singleton for opening the palette from anywhere
let _open: (() => void) | null = null;
export function openCommandPalette() {
  _open?.();
}

export function GlobalCommandPalette({ workspaceSlug }: CommandPaletteProps) {
  const { user, role, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = React.useState(false);
  const [clockBusy, setClockBusy] = React.useState(false);

  // Register open handler
  React.useEffect(() => {
    _open = () => setOpen(true);
    return () => {
      _open = null;
    };
  }, []);

  // Cmd+K / Ctrl+K shortcut
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const filteredNav = React.useMemo(
    () =>
      role
        ? NAV_ENTRIES.filter((n) => n.roles.includes(role))
        : NAV_ENTRIES.filter((n) => n.roles.includes("employee")),
    [role],
  );

  function go(slug: string) {
    setOpen(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    void navigate({ to: `/${workspaceSlug}/${slug}` as any });
  }

  async function clockIn() {
    if (!user) return;
    setClockBusy(true);
    setOpen(false);
    const nowD = new Date();
    const isLate = nowD.getHours() > 9 || (nowD.getHours() === 9 && nowD.getMinutes() > 5);
    await supabase.from("attendance").upsert(
      {
        user_id: user.id,
        date: todayISO(),
        clock_in: nowD.toISOString(),
        clock_out: null,
        status: isLate ? "late" : "present",
      },
      { onConflict: "user_id,date" },
    );
    setClockBusy(false);
  }

  async function clockOut() {
    if (!user) return;
    setClockBusy(true);
    setOpen(false);
    const today = todayISO();
    const { data: att } = await supabase
      .from("attendance")
      .select("id, clock_in, total_minutes, overtime_minutes")
      .eq("user_id", user.id)
      .eq("date", today)
      .not("clock_in", "is", null)
      .is("clock_out", null)
      .maybeSingle();
    if (att?.clock_in) {
      const nowD = new Date();
      const startD = new Date(att.clock_in);
      const mins = Math.max(0, Math.round((nowD.getTime() - startD.getTime()) / 60000));
      await supabase
        .from("attendance")
        .update({
          clock_out: nowD.toISOString(),
          total_minutes: (att.total_minutes ?? 0) + mins,
        })
        .eq("id", att.id);
    }
    setClockBusy(false);
  }

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    void navigate({ to: "/login" });
  }

  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {/* Quick actions */}
        <CommandGroup heading="Quick actions">
          <CommandItem onSelect={() => void clockIn()} disabled={clockBusy}>
            <LogIn className="mr-2 h-4 w-4 text-success" />
            Clock In
            <CommandShortcut>⏰ WAT</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => void clockOut()} disabled={clockBusy}>
            <LogOut className="mr-2 h-4 w-4 text-muted-foreground" />
            Clock Out
          </CommandItem>
          <CommandItem onSelect={() => go("standups")}>
            <ClipboardList className="mr-2 h-4 w-4 text-primary" />
            Submit Today's Standup
          </CommandItem>
          <CommandItem onSelect={() => go("tasks")}>
            <CheckSquare className="mr-2 h-4 w-4 text-primary" />
            View My Tasks
          </CommandItem>
        </CommandGroup>

        {/* Navigation */}
        <CommandGroup heading="Navigate">
          {filteredNav.map((entry) => {
            const Icon = entry.icon;
            const isActive =
              pathname === `/${workspaceSlug}/${entry.slug}` ||
              (entry.slug !== "dashboard" &&
                pathname.startsWith(`/${workspaceSlug}/${entry.slug}`));
            return (
              <CommandItem key={entry.slug} value={entry.label} onSelect={() => go(entry.slug)}>
                <Icon
                  className={`mr-2 h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                />
                {entry.label}
                {isActive && <CommandShortcut className="text-primary">Current</CommandShortcut>}
              </CommandItem>
            );
          })}
        </CommandGroup>

        {/* Account */}
        <CommandGroup heading="Account">
          <CommandItem
            onSelect={() => {
              setOpen(false);
              void navigate({ to: "/workspaces" });
            }}
          >
            <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
            Switch Workspace
          </CommandItem>
          <CommandItem onSelect={() => void handleSignOut()}>
            <LogOut className="mr-2 h-4 w-4 text-destructive" />
            <span className="text-destructive">Sign Out{firstName ? ` (${firstName})` : ""}</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
