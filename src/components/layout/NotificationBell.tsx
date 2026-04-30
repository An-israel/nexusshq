import * as React from "react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
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
      .limit(5);
    setUnread((data as Notif[]) ?? []);
  }, [user]);

  React.useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel(`notif-bell:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, load]);

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
        <div className="border-b border-border p-3">
          <p className="text-sm font-semibold">Notifications</p>
          <p className="text-xs text-muted-foreground">
            {count === 0 ? "You're all caught up." : `${count} unread`}
          </p>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {unread.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">No new notifications</div>
          ) : (
            <ul className="divide-y divide-border">
              {unread.map((n) => (
                <li key={n.id} className="p-3 text-sm hover:bg-accent/40">
                  <p className="font-medium">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="border-t border-border p-2">
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="block rounded-md px-3 py-2 text-center text-xs text-primary hover:bg-accent"
          >
            View all
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
