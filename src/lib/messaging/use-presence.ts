import React from "react";
import { supabase } from "@/integrations/supabase/client";
import type { UserPresence } from "./types";

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

export function usePresence(workspaceId: string | null): {
  presence: Record<string, UserPresence>;
  updateMyPresence: (
    status: UserPresence["status"],
    emoji?: string,
    text?: string,
  ) => Promise<void>;
} {
  const [presence, setPresence] = React.useState<Record<string, UserPresence>>({});
  const myUserIdRef = React.useRef<string | null>(null);

  const updateMyPresence = React.useCallback(
    async (status: UserPresence["status"], emoji?: string, text?: string) => {
      if (!workspaceId) return;

      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) return;

      myUserIdRef.current = user.id;

      const { error } = await supabase.from("user_presence").upsert(
        {
          user_id: user.id,
          workspace_id: workspaceId,
          status,
          status_emoji: emoji ?? null,
          status_text: text ?? null,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,workspace_id" },
      );
      if (error) {
        console.error("updateMyPresence error:", error);
      }
    },
    [workspaceId],
  );

  React.useEffect(() => {
    if (!workspaceId) {
      setPresence({});
      return;
    }

    let mounted = true;

    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        myUserIdRef.current = user.id;
      }

      const { data, error } = await supabase
        .from("user_presence")
        .select("user_id,workspace_id,status,status_emoji,status_text,last_seen_at")
        .eq("workspace_id", workspaceId);

      if (error) {
        console.error("usePresence fetch error:", error);
        return;
      }

      if (!mounted) return;

      const map: Record<string, UserPresence> = {};
      for (const row of data ?? []) {
        map[row.user_id] = row as unknown as UserPresence;
      }
      setPresence(map);

      if (user) {
        await supabase.from("user_presence").upsert(
          {
            user_id: user.id,
            workspace_id: workspaceId,
            status: "active",
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "user_id,workspace_id" },
        );
      }
    };

    init();

    const realtimeChannel = supabase
      .channel(`presence-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_presence",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (!mounted) return;
          if (payload.eventType === "DELETE") {
            const old = payload.old as { user_id?: string };
            if (old.user_id) {
              setPresence((prev) => {
                const next = { ...prev };
                delete next[old.user_id!];
                return next;
              });
            }
          } else {
            const row = payload.new as unknown as UserPresence;
            setPresence((prev) => ({
              ...prev,
              [row.user_id]: row,
            }));
          }
        },
      )
      .subscribe();

    const heartbeat = setInterval(async () => {
      if (!mounted || !myUserIdRef.current) return;
      await supabase.from("user_presence").upsert(
        {
          user_id: myUserIdRef.current,
          workspace_id: workspaceId,
          status: "active",
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,workspace_id" },
      );
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(heartbeat);
      supabase.removeChannel(realtimeChannel);

      if (myUserIdRef.current) {
        supabase
          .from("user_presence")
          .upsert(
            {
              user_id: myUserIdRef.current,
              workspace_id: workspaceId,
              status: "offline",
              last_seen_at: new Date().toISOString(),
            },
            { onConflict: "user_id,workspace_id" },
          )
          .then(() => {});
      }
    };
  }, [workspaceId]);

  return { presence, updateMyPresence };
}
