import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { todayISO, initialsOf, timeAgo } from "@/lib/nexus";
import { useRealtime } from "@/lib/use-realtime";

export const Route = createFileRoute("/_app/standups")({
  component: StandupsPage,
});

interface Standup {
  id: string;
  user_id: string;
  date: string;
  yesterday: string;
  today: string;
  blockers: string | null;
  submitted_at: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

function StandupsPage() {
  const { user, isManager } = useAuth();
  const [view, setView] = React.useState<"mine" | "team">(isManager ? "team" : "mine");
  const [todayStandup, setTodayStandup] = React.useState<Standup | null>(null);
  const [teamStandups, setTeamStandups] = React.useState<Standup[]>([]);
  const [profiles, setProfiles] = React.useState<Record<string, Profile>>({});
  const [loading, setLoading] = React.useState(true);

  // Form state
  const [yesterday, setYesterday] = React.useState("");
  const [today, setToday] = React.useState("");
  const [blockers, setBlockers] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const isoToday = todayISO();

    if (view === "mine") {
      const { data } = await supabase
        .from("standups")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", isoToday)
        .maybeSingle();
      setTodayStandup((data as Standup) ?? null);
    } else {
      const [{ data: standupData }, { data: profData }] = await Promise.all([
        supabase
          .from("standups")
          .select("*")
          .eq("date", isoToday)
          .order("submitted_at", { ascending: true }),
        supabase.from("profiles").select("id, full_name, email").eq("is_active", true),
      ]);
      setTeamStandups((standupData ?? []) as Standup[]);
      const map: Record<string, Profile> = {};
      (profData ?? []).forEach((p) => { map[p.id] = p as Profile; });
      setProfiles(map);
    }
    setLoading(false);
  }, [user, view]);

  React.useEffect(() => { void load(); }, [load]);

  useRealtime({
    table: "standups",
    enabled: !!user && isManager && view === "team",
    onChange: () => void load(),
  });

  async function submit() {
    if (!yesterday.trim() || !today.trim()) {
      toast.error("Please fill in yesterday and today fields");
      return;
    }
    setSubmitting(true);
    const isoToday = todayISO();
    const { error } = await supabase.from("standups").upsert(
      {
        user_id: user!.id,
        date: isoToday,
        yesterday: yesterday.trim(),
        today: today.trim(),
        blockers: blockers.trim() || null,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date" },
    );
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Standup submitted!");
    void load();
  }

  const deadline = "09:30";
  const now = new Date();
  const past = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() >= 30);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Daily Standup</h1>
          <p className="text-sm text-muted-foreground">
            3 quick questions · submit by {deadline} AM daily.
          </p>
        </div>
        {isManager && (
          <Tabs value={view} onValueChange={(v) => setView(v as "mine" | "team")}>
            <TabsList>
              <TabsTrigger value="mine">Mine</TabsTrigger>
              <TabsTrigger value="team">Team view</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      {view === "mine" ? (
        loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : todayStandup ? (
          <SubmittedView standup={todayStandup} onEdit={() => {
            setYesterday(todayStandup.yesterday);
            setToday(todayStandup.today);
            setBlockers(todayStandup.blockers ?? "");
            setTodayStandup(null);
          }} />
        ) : (
          <Card className="p-6 max-w-lg space-y-5">
            {past && (
              <div className="flex items-center gap-2 rounded-lg bg-warning/15 border border-warning/30 px-4 py-2 text-sm text-warning">
                <Clock className="h-4 w-4" />
                <span>Standup deadline ({deadline} AM) has passed. Submit now anyway.</span>
              </div>
            )}
            <div>
              <Label className="text-sm font-medium">
                What did you do yesterday?
              </Label>
              <Textarea
                className="mt-1.5"
                rows={3}
                value={yesterday}
                onChange={(e) => setYesterday(e.target.value)}
                placeholder="Finished the landing page design, reviewed PRs…"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">
                What are you doing today?
              </Label>
              <Textarea
                className="mt-1.5"
                rows={3}
                value={today}
                onChange={(e) => setToday(e.target.value)}
                placeholder="Working on the dashboard, attending sync at 2 PM…"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">
                Any blockers? <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                className="mt-1.5"
                rows={2}
                value={blockers}
                onChange={(e) => setBlockers(e.target.value)}
                placeholder="Waiting on design review from…"
              />
            </div>
            <Button onClick={submit} disabled={submitting} className="w-full">
              {submitting ? "Submitting…" : "Submit standup"}
            </Button>
          </Card>
        )
      ) : (
        <TeamView standups={teamStandups} profiles={profiles} loading={loading} />
      )}
    </div>
  );
}

function SubmittedView({ standup, onEdit }: { standup: Standup; onEdit: () => void }) {
  return (
    <Card className="p-6 max-w-lg space-y-4">
      <div className="flex items-center gap-2 text-success">
        <CheckCircle2 className="h-5 w-5" />
        <span className="font-semibold">Standup submitted</span>
        <span className="text-xs text-muted-foreground">{timeAgo(standup.submitted_at)}</span>
      </div>
      <div className="space-y-3 text-sm">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Yesterday</p>
          <p className="whitespace-pre-wrap">{standup.yesterday}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Today</p>
          <p className="whitespace-pre-wrap">{standup.today}</p>
        </div>
        {standup.blockers && (
          <div className="rounded-lg bg-warning/10 border border-warning/20 p-3">
            <p className="text-xs font-medium text-warning mb-1 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Blockers
            </p>
            <p className="whitespace-pre-wrap text-foreground">{standup.blockers}</p>
          </div>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onEdit}>Edit submission</Button>
    </Card>
  );
}

function TeamView({
  standups,
  profiles,
  loading,
}: {
  standups: Standup[];
  profiles: Record<string, Profile>;
  loading: boolean;
}) {
  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (standups.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        No standups submitted yet today.
      </Card>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {standups.map((s) => {
        const profile = profiles[s.user_id];
        return (
          <Card key={s.id} className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {initialsOf(profile?.full_name ?? profile?.email)}
              </div>
              <div>
                <p className="text-sm font-medium">{profile?.full_name ?? profile?.email ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{timeAgo(s.submitted_at)}</p>
              </div>
            </div>
            <div className="text-xs space-y-2">
              <div>
                <p className="font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Yesterday</p>
                <p className="whitespace-pre-wrap">{s.yesterday}</p>
              </div>
              <div>
                <p className="font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Today</p>
                <p className="whitespace-pre-wrap">{s.today}</p>
              </div>
              {s.blockers && (
                <div className="rounded bg-warning/10 border border-warning/20 p-2">
                  <p className="font-medium text-warning mb-0.5 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Blocker
                  </p>
                  <p className="whitespace-pre-wrap">{s.blockers}</p>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
