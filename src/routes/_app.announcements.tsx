import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Megaphone, Pin, Trash2, Plus } from "lucide-react";
import { DEPARTMENTS, deptLabel, timeAgo } from "@/lib/nexus";
import { useRealtime } from "@/lib/use-realtime";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_app/announcements")({
  component: AnnouncementsPage,
});

interface Announcement {
  id: string;
  title: string;
  body: string;
  author_id: string | null;
  department: string | null;
  is_pinned: boolean;
  created_at: string;
}

interface AuthorMini {
  id: string;
  full_name: string | null;
  email: string | null;
}

function AnnouncementsPage() {
  const { user, isManager, profile } = useAuth();
  const [items, setItems] = React.useState<Announcement[]>([]);
  const [authors, setAuthors] = React.useState<Record<string, AuthorMini>>({});
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const [{ data, error }, { data: profs }] = await Promise.all([
      supabase
        .from("announcements")
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, email"),
    ]);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const rows = (data ?? []) as Announcement[];
    const visible = rows.filter(
      (r) => !r.department || r.department === profile?.department || isManager,
    );
    setItems(visible);
    const map: Record<string, AuthorMini> = {};
    (profs ?? []).forEach((p) => { map[p.id] = p as AuthorMini; });
    setAuthors(map);
    setLoading(false);
  }, [profile?.department, isManager]);

  React.useEffect(() => { void load(); }, [load]);

  useRealtime({
    table: "announcements",
    enabled: !!user,
    onChange: () => void load(),
  });

  async function togglePin(a: Announcement) {
    await supabase.from("announcements").update({ is_pinned: !a.is_pinned }).eq("id", a.id);
    void load();
  }

  async function del(id: string) {
    if (!confirm("Delete this announcement?")) return;
    await supabase.from("announcements").delete().eq("id", id);
    void load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Announcements</h1>
          <p className="text-sm text-muted-foreground">Company-wide and department broadcasts.</p>
        </div>
        {isManager && (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Announcement
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No announcements yet.
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const author = a.author_id ? authors[a.author_id] : null;
            return (
              <Card key={a.id} className={`p-5 ${a.is_pinned ? "border-primary/40 bg-primary/5" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                    <Megaphone className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{a.title}</p>
                      {a.is_pinned && <Pin className="h-3 w-3 text-primary" />}
                      {a.department && (
                        <span className="text-[10px] uppercase tracking-wide rounded border border-border px-1.5 py-0.5 text-muted-foreground">
                          {deptLabel(a.department)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.body}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {author?.full_name ?? author?.email ?? "Team"} · {timeAgo(a.created_at)}
                    </p>
                  </div>
                  {isManager && (
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => togglePin(a)} title={a.is_pinned ? "Unpin" : "Pin"}>
                        <Pin className={`h-3.5 w-3.5 ${a.is_pinned ? "text-primary" : "text-muted-foreground"}`} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => del(a.id)} title="Delete">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <ComposeDialog onSaved={() => { setOpen(false); void load(); }} authorId={user?.id ?? ""} />
      </Dialog>
    </div>
  );
}

function ComposeDialog({ onSaved, authorId }: { onSaved: () => void; authorId: string }) {
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [dept, setDept] = React.useState<string>("all");
  const [saving, setSaving] = React.useState(false);

  async function save() {
    if (!title.trim() || !body.trim()) { toast.error("Title and body are required"); return; }
    setSaving(true);
    const payload: Database["public"]["Tables"]["announcements"]["Insert"] = {
      title: title.trim(),
      body: body.trim(),
      author_id: authorId,
      department: dept === "all" ? null : dept,
    };
    const { error } = await supabase.from("announcements").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Announcement posted");
    onSaved();
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>New Announcement</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Q2 Goals update…" />
        </div>
        <div>
          <Label>Message</Label>
          <Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your announcement…" />
        </div>
        <div>
          <Label>Audience</Label>
          <Select value={dept} onValueChange={setDept}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Whole company</SelectItem>
              {DEPARTMENTS.map((d) => (
                <SelectItem key={d} value={d}>{deptLabel(d)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>{saving ? "Posting…" : "Post"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
