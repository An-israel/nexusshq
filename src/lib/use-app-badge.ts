import { useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useRealtime } from "@/lib/use-realtime";

function applyBadge(count: number) {
  if (!("setAppBadge" in navigator)) return;
  if (count > 0) {
    void (navigator as Navigator & { setAppBadge(n: number): Promise<void> }).setAppBadge(count);
  } else {
    void (navigator as Navigator & { clearAppBadge(): Promise<void> }).clearAppBadge();
  }
}

export function useAppBadge() {
  const { user } = useAuth();

  const refresh = useCallback(async () => {
    if (!user) {
      applyBadge(0);
      return;
    }

    const [{ count: notifCount }, { count: dmCount }] = await Promise.all([
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false),
      supabase
        .from("direct_messages")
        .select("*", { count: "exact", head: true })
        .eq("to_id", user.id)
        .eq("is_read", false),
    ]);

    applyBadge((notifCount ?? 0) + (dmCount ?? 0));
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Clear badge when tab/window gets focus (user is actively using the app)
  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  useRealtime({
    table: "notifications",
    filter: user ? `user_id=eq.${user.id}` : undefined,
    enabled: !!user,
    onChange: () => void refresh(),
  });

  useRealtime({
    table: "direct_messages",
    filter: user ? `to_id=eq.${user.id}` : undefined,
    enabled: !!user,
    onChange: () => void refresh(),
  });

  useRealtime({
    table: "group_messages",
    enabled: !!user,
    onChange: () => void refresh(),
  });
}
