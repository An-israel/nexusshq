import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Bell, AlertCircle, AlertTriangle, CheckSquare, Clock as ClockIcon, Target } from "lucide-react";
import { timeAgo } from "@/lib/nexus";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Notif = Database["public"]["Tables"]["notifications"]["Row"];
type NotifType = Database["public"]["Enums"]["notification_type"];

export const Route = createFileRoute("/_app/notifications")({
  component: NotificationsPage,
});

const TABS: Array<{ key: string; label: string; types?: NotifType[] }> = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "tasks", label: "Tasks", types: ["task_assigned", "task_due_soon", "task_overdue"] },
  { key: "warnings", label: "Warnings", types: ["warning", "flag"] },
  { key: "attendance", label: "Attendance", types: ["clock_reminder"] },
];

function iconFor(type: string) {
  switch (type) {
    case "task_assigned":
    case "task_due_soon":
      return CheckSquare;
    case "task_overdue":
      return AlertTriangle;
    case "warning":
    case "flag":
      return AlertCircle;
    case "clock_reminder":
      return ClockIcon;
    case "kpi_reminder":
      return Target;
    default:
      return Bell;
  }
}

function colorFor(type: string) {
  switch (type) {
    case "warning":
    case "flag":
    case "task_overdue":
      return "text-destructive bg-destructive/15";
    case "task_due_soon":
    case "clock_reminder":
      return "text-warning bg-warning/15";
    default:
      return "text-primary bg-primary/15";
  }
}

function NotificationsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [tab, setTab] = useState("all");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error("Failed to load notifications");
    setNotifs((data as Notif[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const filtered = useMemo(() => {
    if (tab === "all") return notifs;
    if (tab === "unread") return notifs.filter((n) => !n.is_read);
    const t = TABS.find((x) => x.key === tab);
    if (!t?.types) return notifs;
    return notifs.filter((n) => t.types!.includes(n.type));
  }, [notifs, tab]);

  const markAllRead = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    if (error) toast.error(error.message);
    else {
      toast.success("All notifications marked as read");
      load();
    }
  };

  const markRead = async (n: Notif) => {
    if (n.is_read) return;
    await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
    setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
  };

  const unreadCount = notifs.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up."}
          </p>
        </div>
        <Button variant="outline" onClick={markAllRead} disabled={unreadCount === 0}>
          Mark all as read
        </Button>
      </div>

      <div className="flex gap-1 rounded-lg border border-border bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs ${
              tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center text-sm text-muted-foreground">
          Nothing here.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
          {filtered.map((n) => {
            const Icon = iconFor(n.type);
            return (
              <li
                key={n.id}
                className={`flex cursor-pointer items-start gap-3 p-4 transition-colors hover:bg-accent/40 ${
                  !n.is_read ? "bg-primary/5" : ""
                }`}
                onClick={() => markRead(n)}
              >
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${colorFor(n.type)}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{n.title}</p>
                    {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
