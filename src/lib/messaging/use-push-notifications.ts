import React from "react";
import { supabase } from "@/integrations/supabase/client";

export function usePushNotifications(
  currentUserId: string | null,
  _workspaceSlug: string,
): { permissionGranted: boolean } {
  const [permissionGranted, setPermissionGranted] = React.useState(
    typeof Notification !== "undefined" && Notification.permission === "granted",
  );

  React.useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        setPermissionGranted(perm === "granted");
      });
    }
  }, []);

  React.useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`push-notif-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUserId}`,
        },
        (payload) => {
          if (document.visibilityState === "visible") return;
          if (typeof Notification === "undefined") return;
          if (Notification.permission !== "granted") return;

          const row = payload.new as { title: string | null; body: string | null };
          const n = new Notification(row.title ?? "New notification in Nexus HQ", {
            body: row.body ?? "",
            icon: "/favicon.ico",
          });
          n.onclick = () => window.focus();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  return { permissionGranted };
}
