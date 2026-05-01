import * as React from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseRealtimeOptions {
  table: string;
  schema?: string;
  filter?: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  enabled?: boolean;
  onChange: () => void;
}

/**
 * Subscribe to Postgres changes on a table and call onChange when they happen.
 * The callback is debounced internally so rapid bursts only trigger one reload.
 */
export function useRealtime({
  table,
  schema = "public",
  filter,
  event = "*",
  enabled = true,
  onChange,
}: UseRealtimeOptions) {
  const cbRef = React.useRef(onChange);
  cbRef.current = onChange;

  React.useEffect(() => {
    if (!enabled) return;
    const channelName = `rt:${table}:${filter ?? "all"}:${Math.random().toString(36).slice(2, 8)}`;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cbRef.current(), 250);
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
  }, [table, schema, filter, event, enabled]);
}
