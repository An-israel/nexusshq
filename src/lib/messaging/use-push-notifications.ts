import React from "react";
import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

// Convert a base64url VAPID public key to a Uint8Array for pushManager.subscribe().
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

async function registerWebPushSubscription(userId: string): Promise<void> {
  if (!VAPID_PUBLIC_KEY || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    const sub = existing ?? (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

    const json = sub.toJSON();
    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ""}` },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
  } catch {
    // Permission denied or push not supported — silently skip
  }
}

export function usePushNotifications(
  currentUserId: string | null,
  _workspaceSlug: string,
): { permissionGranted: boolean } {
  const [permissionGranted, setPermissionGranted] = React.useState(
    typeof Notification !== "undefined" && Notification.permission === "granted",
  );

  // Request notification permission and register Web Push subscription
  React.useEffect(() => {
    if (typeof Notification === "undefined" || !currentUserId) return;

    if (Notification.permission === "granted") {
      void registerWebPushSubscription(currentUserId);
    } else if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        setPermissionGranted(perm === "granted");
        if (perm === "granted") void registerWebPushSubscription(currentUserId);
      });
    }
  }, [currentUserId]);

  // Foreground notification: show when tab is in background via Supabase realtime
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
          // SW handles background pushes; only show here for visible-but-focused tab
          if (document.visibilityState === "visible") return;
          if (typeof Notification === "undefined") return;
          if (Notification.permission !== "granted") return;

          const row = payload.new as { title: string | null; message: string | null };
          const n = new Notification(row.title ?? "New notification in Nexxos HQ", {
            body: row.message ?? "",
            icon: "/icons/icon.svg",
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
