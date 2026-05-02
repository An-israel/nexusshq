import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Bell, AlertCircle, AlertTriangle, CheckSquare, Clock, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/nexus";
import type { Database } from "@/integrations/supabase/types";

type Notif = Database["public"]["Tables"]["notifications"]["Row"];

function iconFor(type: string) {
  switch (type) {
    case "task_assigned":
    case "task_due_soon": return CheckSquare;
    case "task_overdue": return AlertTriangle;
    case "warning":
    case "flag": return AlertCircle;
    case "clock_reminder": return Clock;
    case "kpi_reminder": return Target;
    default: return Bell;
  }
}

function colorFor(type: string) {
  switch (type) {
    case "warning":
    case "flag":
    case "task_overdue": return "text-destructive bg-destructive/15";
    case "task_due_soon":
    case "clock_reminder": return "text-warning bg-warning/15";
    default: return "text-primary bg-primary/15";
  }
}

export function NotificationBell() {
  const { user } = useAuth();
  const [unread, setUnread] = React.useState<Notif[]>([]);
  const [open, setOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(10);
    setUnread((data as Notif[]) ?? []);
  }, [user]);

  React.useEffect(() => {
    if (!user) return;
    void load();
    const ch = supabase
      .channel(`notif-bell:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => void load(),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user, load]);

  async function markRead(id: string) {
    setUnread((prev) => prev.filter((n) => n.id !== id));
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  }

  async function markAllRead() {
    if (!user) return;
    setUnread([]);
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
  }

  const count = unread.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {count === 0 ? "You're all caught up." : `${count} unread`}
            </p>
          </div>
          {count > 0 && (
            <button
              onClick={markAllRead}
              className="text-[11px] text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {unread.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No new notifications
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {unread.map((n) => {
                const Icon = iconFor(n.type);
                return (
                  <li
                    key={n.id}
                    className="flex cursor-pointer items-start gap-3 p-3 hover:bg-accent/50 transition-colors"
                    onClick={() => void markRead(n.id)}
                  >
                    <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${colorFor(n.type)}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="border-t border-border p-2">
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2 text-center text-xs text-primary hover:bg-accent"
          >
            View all notifications
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
