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
import { CheckCircle2, AlertCircle, Clock, ImageIcon, MessageSquare, Send, Trash2 } from "lucide-react";
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
    if (!user) return;
    setLoading(true);
    const isoToday = todayISO();

    if (view === "mine") {
      const { data } = await supabase
        .from("standups")
        .select("*")
        .eq("user_id", user.id)
        .eq("date", isoToday)
        .eq("workspace_id", workspace.id)
        .maybeSingle();
      setTodayStandup((data as Standup) ?? null);
    } else {
      const [{ data: standupData }, { data: profData }] = await Promise.all([
        supabase
          .from("standups")
          .select("*")
          .eq("date", isoToday)
          .eq("workspace_id", workspace.id)
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
        date: isoToday,
        yesterday: yesterday.trim(),
        today: today.trim(),
        blockers: blockers.trim() || null,
        screenshot_url: urlData.publicUrl,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date" },
    );
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Standup submitted!");
    setScreenshot(null);
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
        <TeamView
          standups={teamStandups}
          profiles={profiles}
          loading={loading}
          currentUserId={user?.id ?? ""}
          isManager={isManager}
        />
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

function TeamView({
  standups,
  profiles,
  loading,
  currentUserId,
  isManager,
}: {
  standups: Standup[];
  profiles: Record<string, Profile>;
  loading: boolean;
  currentUserId: string;
  isManager: boolean;
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
          <StandupCard
            key={s.id}
            standup={s}
            profile={profile}
            currentUserId={currentUserId}
            canComment={isManager}
          />
        );
      })}
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
