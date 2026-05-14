import * as React from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PageFlag {
  key: string;
  label: string;
  /** Default enabled state when no row exists in the DB. */
  defaultEnabled: boolean;
}

/**
 * Pages that can be toggled on/off by admins.
 * The `key` matches the route path (without leading slash) and is what gets stored in feature_flags.key.
 */
export const TOGGLEABLE_PAGES: PageFlag[] = [
  { key: "leave", label: "Leave", defaultEnabled: true },
  { key: "standups", label: "Standups", defaultEnabled: true },
  { key: "deliverables", label: "Deliverables", defaultEnabled: true },
  { key: "reviews", label: "Reviews", defaultEnabled: true },
  { key: "payslips", label: "Payslips", defaultEnabled: true },
  { key: "announcements", label: "Announcements", defaultEnabled: true },
  { key: "messages", label: "Messages", defaultEnabled: true },
  { key: "handbook", label: "Handbook", defaultEnabled: true },
  { key: "org-chart", label: "Org Chart", defaultEnabled: true },
  { key: "team-board", label: "Task Board", defaultEnabled: true },
  { key: "recurring-tasks", label: "Recurring Tasks", defaultEnabled: true },
  { key: "client-projects", label: "Client Projects", defaultEnabled: true },
  { key: "kpis", label: "KPIs", defaultEnabled: true },
  { key: "okrs", label: "Goals & OKRs", defaultEnabled: true },
  { key: "reports", label: "Reports", defaultEnabled: true },
];

export type FlagsMap = Record<string, boolean>;

function buildDefaults(): FlagsMap {
  const out: FlagsMap = {};
  for (const p of TOGGLEABLE_PAGES) out[p.key] = p.defaultEnabled;
  return out;
}

let instanceCounter = 0;

export function useFeatureFlags(
  workspaceId: string | null,
): { flags: FlagsMap; loading: boolean } {
  const [flags, setFlags] = React.useState<FlagsMap>(buildDefaults);
  const [loading, setLoading] = React.useState<boolean>(workspaceId !== null);
  const channelName = React.useRef(`feature_flags_${++instanceCounter}`);

  React.useEffect(() => {
    if (workspaceId === null) {
      setFlags(buildDefaults());
      setLoading(false);
      return;
    }

    let active = true;

    async function load(): Promise<void> {
      try {
        const { data } = await supabase
          .from("feature_flags")
          .select("key, enabled")
          .eq("workspace_id", workspaceId!);
        if (!active) return;
        const next = buildDefaults();
        for (const row of data ?? []) next[row.key] = row.enabled;
        setFlags(next);
      } catch {
        // Table may not exist yet; fall back to defaults
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(channelName.current)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "feature_flags",
            filter: `workspace_id=eq.${workspaceId}`,
          },
          () => void load(),
        )
        .subscribe();
    } catch {
      // Realtime unavailable; polling not needed
    }

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  return { flags, loading };
}

export async function setFeatureFlag(
  key: string,
  enabled: boolean,
  workspaceId: string,
  userId?: string,
): Promise<void> {
  const { error } = await supabase
    .from("feature_flags")
    .upsert(
      {
        key,
        enabled,
        workspace_id: workspaceId,
        updated_by: userId ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key,workspace_id" },
    );
  if (error) throw error;
}
