import * as React from "react";
import { formatDistanceToNow, isToday, isYesterday, format, startOfWeek, isAfter } from "date-fns";
import { Bell, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { initialsOf } from "@/lib/nexus";
import type { UserPresence } from "@/lib/messaging/types";

interface ActivityFeedProps {
  workspaceId: string;
  currentUserId: string;
  workspaceSlug: string;
  presence: Record<string, UserPresence>;
}

interface Notification {
  id: string;
  user_id: string;
  workspace_id: string;
  type: string;
  title: string | null;
  body: string | null;
  sender_id: string | null;
  is_read: boolean;
  created_at: string;
  sender?: {
    id: string;
    full_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
}

function hashColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 40%)`;
}

function SenderAvatar({ sender }: { sender: Notification["sender"] }) {
  const name = sender?.full_name ?? sender?.email ?? "?";
  if (sender?.avatar_url) {
    return (
      <img
        src={sender.avatar_url}
        alt={name}
        className="h-9 w-9 rounded-full object-cover shrink-0"
      />
    );
  }
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
      style={{ backgroundColor: sender ? hashColor(sender.id) : "#374151" }}
    >
      {initialsOf(name)}
    </div>
  );
}

function notifLabel(notif: Notification): string {
  const senderName = notif.sender?.full_name ?? notif.sender?.email ?? "Someone";
  switch (notif.type) {
    case "mention":
      return `${senderName} mentioned you`;
    case "direct_message":
      return `${senderName} sent you a message`;
    case "group_message":
      return `${senderName} sent a group message`;
    case "reaction":
      return `${senderName} reacted to your message`;
    default:
      return notif.title ?? `${senderName} sent you a notification`;
  }
}

function groupLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  const weekStart = startOfWeek(new Date());
  if (isAfter(date, weekStart)) return "Earlier this week";
  return format(date, "MMMM d, yyyy");
}

export function ActivityFeed({
  workspaceId,
  currentUserId,
}: ActivityFeedProps) {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [markingRead, setMarkingRead] = React.useState(false);

  const fetchNotifications = React.useCallback(async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", currentUserId)
      .eq("workspace_id", workspaceId)
      .in("type", ["mention", "direct_message", "group_message", "reaction"] as never)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("ActivityFeed fetch error:", error);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as unknown as Notification[];
    const senderIds = Array.from(new Set(rows.map((n) => n.sender_id).filter((id): id is string => !!id)));

    let senderMap: Record<string, Notification["sender"]> = {};
    if (senderIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", senderIds);
      for (const p of profiles ?? []) {
        senderMap[p.id] = p as Notification["sender"];
      }
    }

    setNotifications(
      rows.map((n) => ({
        ...n,
        sender: n.sender_id ? senderMap[n.sender_id] ?? null : null,
      }))
    );
    setLoading(false);
  }, [workspaceId, currentUserId]);

  React.useEffect(() => {
    setLoading(true);
    fetchNotifications();
  }, [fetchNotifications]);

  React.useEffect(() => {
    const channel = supabase
      .channel(`activity-feed-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, fetchNotifications]);

  async function markAllRead() {
    setMarkingRead(true);
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", currentUserId)
      .eq("workspace_id", workspaceId)
      .eq("is_read", false);
    if (error) {
      toast.error("Failed to mark all as read");
    } else {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      toast.success("All notifications marked as read");
    }
    setMarkingRead(false);
  }

  const grouped = React.useMemo(() => {
    const groups: { label: string; items: Notification[] }[] = [];
    const seen = new Set<string>();

    for (const notif of notifications) {
      const label = groupLabel(new Date(notif.created_at));
      if (!seen.has(label)) {
        seen.add(label);
        groups.push({ label, items: [] });
      }
      groups[groups.length - 1].items.push(notif);
    }

    return groups;
  }, [notifications]);

  const hasUnread = notifications.some((n) => !n.is_read);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#0F0F0F]">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#2A2A2A] px-5 py-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-[#9CA3AF]" />
          <h2 className="font-semibold text-white">Activity</h2>
        </div>
        {hasUnread && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void markAllRead()}
            disabled={markingRead}
            className="flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-white"
          >
            <Check className="h-3.5 w-3.5" />
            Mark all as read
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#1A1A1A]">
              <Bell className="h-6 w-6 text-[#6B7280]" />
            </div>
            <p className="font-semibold text-white">You&apos;re all caught up!</p>
            <p className="mt-1 text-sm text-[#6B7280]">No new activity to show.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1A1A1A]">
            {grouped.map(({ label, items }) => (
              <div key={label}>
                <div className="sticky top-0 bg-[#0F0F0F] px-5 py-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                    {label}
                  </span>
                </div>
                {items.map((notif) => (
                  <div
                    key={notif.id}
                    className={cn(
                      "flex items-start gap-3 px-5 py-3 transition-colors hover:bg-[#1A1A1A]",
                      !notif.is_read && "bg-[#1A1A1A]/50"
                    )}
                  >
                    <SenderAvatar sender={notif.sender} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-[#E5E7EB]">{notifLabel(notif)}</p>
                        <span className="shrink-0 text-[11px] text-[#6B7280]">
                          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {notif.body && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-[#6B7280]">{notif.body}</p>
                      )}
                    </div>
                    {!notif.is_read && (
                      <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
