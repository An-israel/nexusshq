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
  { key: "ai-tasks", label: "AI Tasks", defaultEnabled: true },
];

export type FlagsMap = Record<string, boolean>;

function buildDefaults(): FlagsMap {
  const out: FlagsMap = {};
  for (const p of TOGGLEABLE_PAGES) out[p.key] = p.defaultEnabled;
  return out;
}

export function useFeatureFlags(): { flags: FlagsMap; loading: boolean } {
  const [flags, setFlags] = React.useState<FlagsMap>(buildDefaults);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    async function load() {
      const { data } = await supabase
        .from("feature_flags")
        .select("key, enabled");
      if (!active) return;
      const next = buildDefaults();
      for (const row of data ?? []) next[row.key] = row.enabled;
      setFlags(next);
      setLoading(false);
    }
    void load();

    const channel = supabase
      .channel("feature_flags")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feature_flags" },
        () => void load(),
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  return { flags, loading };
}

export async function setFeatureFlag(key: string, enabled: boolean, userId?: string) {
  const { error } = await supabase
    .from("feature_flags")
    .upsert(
      { key, enabled, updated_by: userId ?? null, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw error;
}
