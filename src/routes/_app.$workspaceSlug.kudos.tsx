import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Heart, Send, Award } from "lucide-react";
import { timeAgo } from "@/lib/nexus";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/$workspaceSlug/kudos")({
  component: KudosPage,
});

const EMOJIS = ["⭐", "🔥", "💪", "🎉", "🙌", "👏", "🚀", "💡", "❤️", "🏆"];

interface KudosRow {
  id: string;
  workspace_id: string;
  from_user_id: string;
  to_user_id: string;
  message: string;
  emoji: string;
  created_at: string;
}

interface ProfileMini {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

function KudosPage() {
  const { user, profile } = useAuth();
  const { workspace } = useWorkspace();
  const [kudos, setKudos] = React.useState<KudosRow[]>([]);
  const [profiles, setProfiles] = React.useState<Record<string, ProfileMini>>({});
  const [teamMembers, setTeamMembers] = React.useState<ProfileMini[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sendOpen, setSendOpen] = React.useState(false);

  // Form state
  const [toUserId, setToUserId] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [emoji, setEmoji] = React.useState("⭐");
  const [sending, setSending] = React.useState(false);

  const [migrationPending, setMigrationPending] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("kudos")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      if (error.message.includes("schema cache") || error.message.includes("does not exist") || error.code === "42P01") {
        setMigrationPending(true);
      } else {
        toast.error(error.message);
      }
      setLoading(false);
      return;
    }
    setMigrationPending(false);
    const rows = (data ?? []) as KudosRow[];
    setKudos(rows);

    // Fetch all profiles mentioned
    const ids = Array.from(new Set([...rows.map(k => k.from_user_id), ...rows.map(k => k.to_user_id)]));
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", ids);
      const map: Record<string, ProfileMini> = {};
      (profs ?? []).forEach(p => { map[p.id] = p as ProfileMini; });
      setProfiles(map);
    }
    setLoading(false);
  }, [workspace.id]);

  React.useEffect(() => { void load(); }, [load]);

  // Load team members for "Send Kudos" recipient picker — SCOPED to current workspace
  React.useEffect(() => {
    if (!workspace?.id) return;
    void (async () => {
      const { data: members, error: memErr } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspace.id)
        .eq("is_active", true);
      if (memErr) { console.error("Recognition: load members failed", memErr); return; }
      const ids = (members ?? []).map((m) => m.user_id).filter((id) => id !== user?.id);
      if (!ids.length) { setTeamMembers([]); return; }
      const { data: profs, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", ids)
        .order("full_name");
      if (profErr) { console.error("Recognition: load profiles failed", profErr); return; }
      setTeamMembers((profs ?? []) as ProfileMini[]);
    })();
  }, [workspace?.id, user?.id]);

  async function sendKudos() {
    if (!toUserId) return toast.error("Pick a teammate");
    if (!message.trim()) return toast.error("Write a message");
    if (message.trim().length > 280) return toast.error("Message too long (max 280 chars)");
    setSending(true);
    const { error } = await supabase.from("kudos").insert({
      workspace_id: workspace.id,
      from_user_id: user!.id,
      to_user_id: toUserId,
      message: message.trim(),
      emoji,
    });
    if (error) { toast.error(error.message); setSending(false); return; }

    // Send notification to recipient
    await supabase.from("notifications").insert({
      user_id: toUserId,
      workspace_id: workspace.id,
      type: "flag",
      title: `${emoji} Kudos from ${profile?.full_name ?? "a teammate"}`,
      message: message.trim(),
    });

    toast.success("Kudos sent! 🎉");
    setSendOpen(false);
    setToUserId("");
    setMessage("");
    setEmoji("⭐");
    setSending(false);
    void load();
  }

  function nameOf(id: string) {
    const p = profiles[id];
    return p?.full_name ?? p?.email ?? "Someone";
  }

  function initials(id: string) {
    return nameOf(id).slice(0, 1).toUpperCase();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Recognition</h1>
          <p className="text-sm text-muted-foreground">Celebrate teammates doing great work.</p>
        </div>
        <Button onClick={() => setSendOpen(true)}>
          <Heart className="mr-2 h-4 w-4" /> Send Kudos
        </Button>
      </div>

      {/* Migration pending banner */}
      {migrationPending && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 space-y-2">
          <p className="text-sm font-semibold text-warning">Database migration required</p>
          <p className="text-xs text-muted-foreground">
            The Recognition feature needs a database table that hasn't been created yet.
            Please run the migration in your Supabase SQL editor:
          </p>
          <p className="text-xs font-mono bg-muted rounded p-2 break-all">
            supabase/migrations/20260514000000_kudos_documents_gps_whatsapp.sql
          </p>
        </div>
      )}

      {/* Send Kudos Dialog */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Kudos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Emoji picker */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Pick an emoji</Label>
              <div className="flex gap-2 flex-wrap">
                {EMOJIS.map(e => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className={cn(
                      "text-2xl rounded-xl p-2 transition-all active:scale-95",
                      emoji === e ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-muted"
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient */}
            <div>
              <Label>To</Label>
              <Select value={toUserId} onValueChange={setToUserId}>
                <SelectTrigger className="text-base md:text-sm">
                  <SelectValue placeholder="Pick a teammate" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name ?? m.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Message */}
            <div>
              <Label>Message</Label>
              <Textarea
                className="text-base md:text-sm"
                rows={3}
                placeholder="Great job on the client pitch! Your work made a real difference."
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={280}
              />
              <p className="text-right text-xs text-muted-foreground mt-1">{message.length}/280</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={sendKudos} disabled={sending}>
              <Send className="mr-2 h-4 w-4" />
              {sending ? "Sending…" : "Send Kudos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Feed */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48 rounded" />
                  <Skeleton className="h-4 w-full rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : kudos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Award className="h-14 w-14 text-muted-foreground/30" />
          <p className="text-base font-medium text-muted-foreground">No kudos yet</p>
          <p className="text-sm text-muted-foreground">Be the first to celebrate a teammate.</p>
          <Button variant="outline" onClick={() => setSendOpen(true)}>
            <Heart className="mr-2 h-4 w-4" /> Send the first kudos
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {kudos.map(k => (
            <Card key={k.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                  {initials(k.to_user_id)}
                </div>
                <div className="flex-1 min-w-0">
                  {/* Header */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-2xl leading-none">{k.emoji}</span>
                    <p className="text-sm font-semibold">{nameOf(k.to_user_id)}</p>
                    <span className="text-xs text-muted-foreground">from {nameOf(k.from_user_id)}</span>
                  </div>
                  {/* Message */}
                  <p className="mt-2 text-sm text-foreground leading-relaxed">{k.message}</p>
                  {/* Timestamp */}
                  <p className="mt-2 text-xs text-muted-foreground">{timeAgo(k.created_at)}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
