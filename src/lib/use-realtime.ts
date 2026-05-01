import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type AnyRow = Record<string, unknown>;

interface UseRealtimeOptions {
  table: string;
  schema?: string;
  filter?: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  enabled?: boolean;
  /** Called (debounced) when a change matches. */
  onChange: (payload?: RealtimePostgresChangesPayload<AnyRow>) => void;
  /**
   * Optional: when provided, return false to ignore an event (no refetch, no toast).
   * Use this to scope updates to "rows that actually affect the current view".
   */
  shouldHandle?: (payload: RealtimePostgresChangesPayload<AnyRow>) => boolean;
  /** Debounce window in ms. Default 400. */
  debounceMs?: number;
}

/**
 * Subscribe to Postgres changes on a table and call onChange when they happen.
 *
 * Guardrails:
 * - Debounces bursts so onChange fires at most once per `debounceMs` window
 * - Tracks reload frequency and pauses if firing >10x in 5s (prevents loops)
 * - Optional `shouldHandle` predicate avoids unnecessary refetches
 */
export function useRealtime({
  table,
  schema = "public",
  filter,
  event = "*",
  enabled = true,
  onChange,
  shouldHandle,
  debounceMs = 400,
}: UseRealtimeOptions) {
  const cbRef = React.useRef(onChange);
  const filterRef = React.useRef(shouldHandle);
  cbRef.current = onChange;
  filterRef.current = shouldHandle;

  React.useEffect(() => {
    if (!enabled) return;
    const channelName = `rt:${table}:${filter ?? "all"}:${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastPayload: RealtimePostgresChangesPayload<AnyRow> | undefined;

    // Loop-guard: track call timestamps in a sliding 5s window
    let recentCalls: number[] = [];
    let pausedUntil = 0;

    const fire = () => {
      const now = Date.now();
      if (now < pausedUntil) return;
      recentCalls = recentCalls.filter((t) => now - t < 5000);
      recentCalls.push(now);
      if (recentCalls.length > 10) {
        // Too chatty — back off for 10s
        pausedUntil = now + 10_000;
        recentCalls = [];
        console.warn(
          `[useRealtime] Pausing ${table} subscription for 10s (too many updates).`,
        );
        return;
      }
      cbRef.current(lastPayload);
      lastPayload = undefined;
    };

    const trigger = (payload: RealtimePostgresChangesPayload<AnyRow>) => {
      if (filterRef.current && !filterRef.current(payload)) return;
      lastPayload = payload;
      if (timer) clearTimeout(timer);
      timer = setTimeout(fire, debounceMs);
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes" as never,
        { event, schema, table, ...(filter ? { filter } : {}) } as never,
        trigger as never,
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [table, schema, filter, event, enabled, debounceMs]);
}
