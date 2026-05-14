import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, Clock, ImageIcon, MessageSquare, Send, Trash2, Folder, FolderOpen, ChevronRight, ArrowLeft } from "lucide-react";
import { todayISO, initialsOf, timeAgo } from "@/lib/nexus";
import { useRealtime } from "@/lib/use-realtime";

export const Route = createFileRoute("/_app/$workspaceSlug/standups")({
  component: StandupsPage,
});

interface Standup {
  id: string;
  user_id: string;
  date: string;
  yesterday: string;
  today: string;
  blockers: string | null;
  screenshot_url: string | null;
  submitted_at: string;
}

interface StandupComment {
  id: string;
  standup_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
}

const SCREENSHOT_MAX = 10 * 1024 * 1024; // 10MB

function StandupsPage() {
  const { user, isManager } = useAuth();
  const { workspace } = useWorkspace();
  const [view, setView] = React.useState<"mine" | "team">(isManager ? "team" : "mine");
  const [todayStandup, setTodayStandup] = React.useState<Standup | null>(null);
  const [historyStandups, setHistoryStandups] = React.useState<Standup[]>([]);
  const [teamStandups, setTeamStandups] = React.useState<Standup[]>([]);
  const [profiles, setProfiles] = React.useState<Record<string, Profile>>({});
  const [loading, setLoading] = React.useState(true);

  // Form state
  const [yesterday, setYesterday] = React.useState("");
  const [today, setToday] = React.useState("");
  const [blockers, setBlockers] = React.useState("");
  const [screenshot, setScreenshot] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!user || !workspace?.id) return;
    setLoading(true);
    const isoToday = todayISO();
    const archiveSince = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    if (view === "mine") {
      const [{ data: today }, { data: history }] = await Promise.all([
        supabase
          .from("standups")
          .select("*")
          .eq("user_id", user.id)
          .eq("date", isoToday)
          .eq("workspace_id", workspace.id)
          .maybeSingle(),
        supabase
          .from("standups")
          .select("*")
          .eq("user_id", user.id)
          .eq("workspace_id", workspace.id)
          .lt("date", isoToday)
          .gte("date", archiveSince)
          .order("date", { ascending: false }),
      ]);
      setTodayStandup((today as Standup) ?? null);
      setHistoryStandups((history ?? []) as Standup[]);
    } else {
      const [{ data: standupData }, { data: profData }] = await Promise.all([
        supabase
          .from("standups")
          .select("*")
          .eq("workspace_id", workspace.id)
          .gte("date", archiveSince)
          .order("date", { ascending: false })
          .order("submitted_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name, email").eq("is_active", true),
      ]);
      setTeamStandups((standupData ?? []) as Standup[]);
      const map: Record<string, Profile> = {};
      (profData ?? []).forEach((p) => { map[p.id] = p as Profile; });
      setProfiles(map);
    }
    setLoading(false);
  }, [user, view, workspace?.id]);

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
    if (!screenshot) {
      toast.error("Please attach a screenshot of yesterday's work");
      return;
    }
    if (screenshot.size > SCREENSHOT_MAX) {
      toast.error("Screenshot must be under 10MB");
      return;
    }
    setSubmitting(true);

    // Upload screenshot
    const ext = screenshot.name.split(".").pop() ?? "png";
    const path = `${user!.id}/${todayISO()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("standup-screenshots")
      .upload(path, screenshot, { upsert: true, contentType: screenshot.type });
    if (upErr) { toast.error(upErr.message); setSubmitting(false); return; }
    const { data: urlData } = supabase.storage.from("standup-screenshots").getPublicUrl(path);

    const isoToday = todayISO();
    const { error } = await supabase.from("standups").upsert(
      {
        user_id: user!.id,
        workspace_id: workspace?.id,
        date: isoToday,
        yesterday: yesterday.trim(),
        today: today.trim(),
        blockers: blockers.trim() || null,
        screenshot_url: urlData.publicUrl,
        submitted_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,date" },
    );
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Standup submitted!");
    setScreenshot(null);
    void load();
  }

  const deadline = "10:00";
  const now = new Date();
  const past = now.getHours() >= 10;

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
            setScreenshot(null);
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
              <Label className="text-sm font-medium">What did you do yesterday?</Label>
              <Textarea
                className="mt-1.5"
                rows={3}
                value={yesterday}
                onChange={(e) => setYesterday(e.target.value)}
                placeholder="Finished the landing page design, reviewed PRs…"
              />
            </div>
            <div>
              <Label className="text-sm font-medium">What are you doing today?</Label>
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
            <div>
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <ImageIcon className="h-4 w-4" />
                Screenshot of yesterday's work{" "}
                <span className="font-normal text-destructive text-xs">(required)</span>
              </Label>
              <Input
                className="mt-1.5"
                type="file"
                accept="image/*"
                onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
              />
              {screenshot && (
                <p className="text-xs text-muted-foreground mt-1">
                  {screenshot.name} ({(screenshot.size / 1024).toFixed(0)} KB)
                </p>
              )}
            </div>
            <Button onClick={submit} disabled={submitting} className="w-full">
              {submitting ? "Submitting…" : "Submit standup"}
            </Button>
          </Card>
        )
      ) : (
        loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : teamStandups.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No standups submitted yet.
          </Card>
        ) : (
          <FolderBrowser
            standups={teamStandups}
            profiles={profiles}
            currentUserId={user?.id ?? ""}
            isManager={isManager}
            showAuthor
          />
        )
      )}

      {view === "mine" && historyStandups.length > 0 && (
        <div className="mt-8 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">Archive</h2>
          <FolderBrowser
            standups={historyStandups}
            profiles={profiles}
            currentUserId={user?.id ?? ""}
            isManager={isManager}
            showAuthor={false}
          />
        </div>
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
        {standup.screenshot_url && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Screenshot</p>
            <a href={standup.screenshot_url} target="_blank" rel="noopener noreferrer">
              <img
                src={standup.screenshot_url}
                alt="Yesterday's work"
                className="rounded-lg border border-border max-h-48 object-cover hover:opacity-90 transition-opacity"
              />
            </a>
          </div>
        )}
      </div>
      <Button variant="outline" size="sm" onClick={onEdit}>Edit submission</Button>
    </Card>
  );
}

// ---- Folder browser: Week → Day → Standups ----

function isoWeekKey(d: Date): { key: string; year: number; week: number; start: Date; end: Date } {
  // ISO week calculation
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const year = date.getUTCFullYear();
  // Compute Monday of the week
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const start = new Date(mondayWeek1);
  start.setUTCDate(mondayWeek1.getUTCDate() + (week - 1) * 7);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { key: `${year}-W${String(week).padStart(2, "0")}`, year, week, start, end };
}

function fmtDateRange(start: Date, end: Date): string {
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const fmtDay = (d: Date) => d.getUTCDate();
  const fmtMonth = (d: Date) => d.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });
  if (sameMonth) return `${fmtMonth(start)} ${fmtDay(start)}–${fmtDay(end)}, ${start.getUTCFullYear()}`;
  return `${fmtMonth(start)} ${fmtDay(start)} – ${fmtMonth(end)} ${fmtDay(end)}, ${end.getUTCFullYear()}`;
}

function FolderBrowser({
  standups,
  profiles,
  currentUserId,
  isManager,
  showAuthor,
}: {
  standups: Standup[];
  profiles: Record<string, Profile>;
  currentUserId: string;
  isManager: boolean;
  showAuthor: boolean;
}) {
  const [selectedWeek, setSelectedWeek] = React.useState<string | null>(null);
  const [selectedDay, setSelectedDay] = React.useState<string | null>(null);

  // Group by week
  const weeks = React.useMemo(() => {
    const map = new Map<string, { meta: ReturnType<typeof isoWeekKey>; items: Standup[] }>();
    for (const s of standups) {
      const d = new Date(s.date + "T00:00:00Z");
      const meta = isoWeekKey(d);
      const entry = map.get(meta.key) ?? { meta, items: [] };
      entry.items.push(s);
      map.set(meta.key, entry);
    }
    return Array.from(map.values()).sort((a, b) => (a.meta.key < b.meta.key ? 1 : -1));
  }, [standups]);

  const currentWeek = selectedWeek ? weeks.find((w) => w.meta.key === selectedWeek) : null;

  // Group selected week by day
  const days = React.useMemo(() => {
    if (!currentWeek) return [];
    const map = new Map<string, Standup[]>();
    for (const s of currentWeek.items) {
      const arr = map.get(s.date) ?? [];
      arr.push(s);
      map.set(s.date, arr);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, items]) => ({ date, items }));
  }, [currentWeek]);

  const dayItems = selectedDay && currentWeek
    ? currentWeek.items.filter((s) => s.date === selectedDay)
    : [];

  // Breadcrumbs
  const Crumb = (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={() => { setSelectedWeek(null); setSelectedDay(null); }}
        className={`hover:text-foreground transition-colors ${selectedWeek ? "text-muted-foreground" : "font-semibold"}`}
      >
        All weeks
      </button>
      {selectedWeek && currentWeek && (
        <>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <button
            onClick={() => setSelectedDay(null)}
            className={`hover:text-foreground transition-colors ${selectedDay ? "text-muted-foreground" : "font-semibold"}`}
          >
            {fmtDateRange(currentWeek.meta.start, currentWeek.meta.end)}
          </button>
        </>
      )}
      {selectedDay && (
        <>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-semibold">
            {new Date(selectedDay + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}
          </span>
        </>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {Crumb}
        {(selectedWeek || selectedDay) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (selectedDay) setSelectedDay(null);
              else setSelectedWeek(null);
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        )}
      </div>

      {!selectedWeek && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {weeks.map((w) => (
            <button
              key={w.meta.key}
              onClick={() => setSelectedWeek(w.meta.key)}
              className="group text-left"
            >
              <Card className="p-4 hover:border-primary/50 hover:shadow-sm transition-all">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary group-hover:bg-primary/15 transition-colors">
                    <Folder className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">Week {w.meta.week}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDateRange(w.meta.start, w.meta.end)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {w.items.length} {w.items.length === 1 ? "entry" : "entries"}
                    </p>
                  </div>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      {selectedWeek && !selectedDay && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {days.map(({ date, items }) => {
            const d = new Date(date + "T00:00:00Z");
            return (
              <button
                key={date}
                onClick={() => setSelectedDay(date)}
                className="group text-left"
              >
                <Card className="p-4 hover:border-primary/50 hover:shadow-sm transition-all">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-accent p-2 text-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <FolderOpen className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">
                        {d.toLocaleDateString(undefined, { weekday: "long", timeZone: "UTC" })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {items.length} {items.length === 1 ? "entry" : "entries"}
                      </p>
                    </div>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {selectedDay && (
        showAuthor ? (
          <div className="grid gap-4 md:grid-cols-2">
            {dayItems.map((s) => (
              <StandupCard
                key={s.id}
                standup={s}
                profile={profiles[s.user_id]}
                currentUserId={currentUserId}
                canComment={isManager}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {dayItems.map((s) => (
              <Card key={s.id} className="p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {new Date(s.date + "T00:00:00Z").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" })}
                  </span>
                  <span className="text-xs text-muted-foreground">{timeAgo(s.submitted_at)}</span>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Yesterday</p>
                  <p className="whitespace-pre-wrap">{s.yesterday}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Today</p>
                  <p className="whitespace-pre-wrap">{s.today}</p>
                </div>
                {s.blockers && (
                  <div className="rounded bg-warning/10 border border-warning/20 p-2 text-xs">
                    <p className="font-medium text-warning mb-0.5">Blockers</p>
                    <p className="whitespace-pre-wrap">{s.blockers}</p>
                  </div>
                )}
                {s.screenshot_url && (
                  <a href={s.screenshot_url} target="_blank" rel="noopener noreferrer">
                    <img
                      src={s.screenshot_url}
                      alt="Screenshot"
                      className="rounded border border-border max-h-40 object-cover hover:opacity-90 transition-opacity"
                    />
                  </a>
                )}
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function StandupCard({
  standup,
  profile,
  currentUserId,
  canComment,
}: {
  standup: Standup;
  profile: Profile | undefined;
  currentUserId: string;
  canComment: boolean;
}) {
  const [comments, setComments] = React.useState<StandupComment[]>([]);
  const [commentProfiles, setCommentProfiles] = React.useState<Record<string, Profile>>({});
  const [showComments, setShowComments] = React.useState(false);
  const [commentText, setCommentText] = React.useState("");
  const [posting, setPosting] = React.useState(false);

  const loadComments = React.useCallback(async () => {
    const { data } = await supabase
      .from("standup_comments")
      .select("*")
      .eq("standup_id", standup.id)
      .order("created_at", { ascending: true });
    const rows = (data ?? []) as StandupComment[];
    setComments(rows);
    const ids = Array.from(new Set(rows.map((c) => c.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id, full_name, email").in("id", ids);
      const map: Record<string, Profile> = {};
      (profs ?? []).forEach((p) => { map[p.id] = p as Profile; });
      setCommentProfiles(map);
    }
  }, [standup.id]);

  React.useEffect(() => {
    if (showComments) void loadComments();
  }, [showComments, loadComments]);

  async function postComment() {
    if (!commentText.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("standup_comments").insert({
      standup_id: standup.id,
      user_id: currentUserId,
      body: commentText.trim(),
    });
    setPosting(false);
    if (error) { toast.error(error.message); return; }
    setCommentText("");
    void loadComments();
  }

  async function deleteComment(id: string) {
    await supabase.from("standup_comments").delete().eq("id", id);
    void loadComments();
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          {initialsOf(profile?.full_name ?? profile?.email)}
        </div>
        <div>
          <p className="text-sm font-medium">{profile?.full_name ?? profile?.email ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{timeAgo(standup.submitted_at)}</p>
        </div>
      </div>
      <div className="text-xs space-y-2">
        <div>
          <p className="font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Yesterday</p>
          <p className="whitespace-pre-wrap">{standup.yesterday}</p>
        </div>
        <div>
          <p className="font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Today</p>
          <p className="whitespace-pre-wrap">{standup.today}</p>
        </div>
        {standup.blockers && (
          <div className="rounded bg-warning/10 border border-warning/20 p-2">
            <p className="font-medium text-warning mb-0.5 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Blocker
            </p>
            <p className="whitespace-pre-wrap">{standup.blockers}</p>
          </div>
        )}
        {standup.screenshot_url && (
          <div>
            <p className="font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Screenshot</p>
            <a href={standup.screenshot_url} target="_blank" rel="noopener noreferrer">
              <img
                src={standup.screenshot_url}
                alt="Screenshot"
                className="rounded border border-border max-h-32 object-cover hover:opacity-80 transition-opacity w-full"
              />
            </a>
          </div>
        )}
      </div>

      {/* Comments toggle */}
      <button
        onClick={() => setShowComments((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {comments.length > 0 ? `${comments.length} comment${comments.length !== 1 ? "s" : ""}` : "Add comment"}
        {!showComments && comments.length === 0 && canComment && " ›"}
      </button>

      {showComments && (
        <div className="space-y-2 pt-1 border-t border-border">
          {comments.map((c) => {
            const cp = commentProfiles[c.user_id];
            return (
              <div key={c.id} className="flex items-start gap-2 text-xs group">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-semibold">
                  {initialsOf(cp?.full_name ?? cp?.email)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium">{cp?.full_name ?? cp?.email ?? "—"}</span>
                  <span className="text-muted-foreground ml-1">{timeAgo(c.created_at)}</span>
                  <p className="text-foreground mt-0.5 whitespace-pre-wrap">{c.body}</p>
                </div>
                {c.user_id === currentUserId && (
                  <button
                    onClick={() => void deleteComment(c.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
          {canComment && (
            <div className="flex gap-2 mt-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void postComment(); } }}
                placeholder="Leave a comment…"
                className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={() => void postComment()}
                disabled={posting || !commentText.trim()}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                <Send className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
