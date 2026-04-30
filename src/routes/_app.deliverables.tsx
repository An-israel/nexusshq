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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Upload, Download, FileText, Check, X, RotateCcw } from "lucide-react";
import { timeAgo } from "@/lib/nexus";

export const Route = createFileRoute("/_app/deliverables")({
  component: DeliverablesPage,
});

const MAX_BYTES = 25 * 1024 * 1024; // 25MB

type DStatus = "submitted" | "approved" | "rejected" | "revision_requested";

interface DeliverableRow {
  id: string;
  task_id: string | null;
  user_id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string | null;
  storage_path: string;
  description: string | null;
  status: DStatus;
  reviewer_id: string | null;
  reviewer_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface ProfileMini { id: string; full_name: string | null; email: string | null; }
interface TaskMini { id: string; title: string; }

const STATUS_STYLE: Record<DStatus, string> = {
  submitted: "bg-primary/15 text-primary border-primary/30",
  approved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  revision_requested: "bg-warning/15 text-warning border-warning/30",
};

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function DeliverablesPage() {
  const { user, isManager } = useAuth();
  const [scope, setScope] = React.useState<"mine" | "all">(isManager ? "all" : "mine");
  const [items, setItems] = React.useState<DeliverableRow[]>([]);
  const [profiles, setProfiles] = React.useState<Record<string, ProfileMini>>({});
  const [loading, setLoading] = React.useState(true);
  const [uploadOpen, setUploadOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase.from("deliverables").select("*").order("created_at", { ascending: false });
    if (scope === "mine" || !isManager) q = q.eq("user_id", user.id);
    const { data, error } = await q;
    if (error) { toast.error(error.message); setLoading(false); return; }
    const rows = (data ?? []) as DeliverableRow[];
    setItems(rows);
    const ids = Array.from(new Set(rows.map((r) => r.user_id)));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles").select("id, full_name, email").in("id", ids);
      const map: Record<string, ProfileMini> = {};
      (profs ?? []).forEach((p) => { map[p.id] = p as ProfileMini; });
      setProfiles(map);
    }
    setLoading(false);
  }, [user, isManager, scope]);

  React.useEffect(() => { void load(); }, [load]);

  async function downloadFile(d: DeliverableRow) {
    const { data, error } = await supabase.storage.from("deliverables").createSignedUrl(d.storage_path, 60);
    if (error || !data) { toast.error(error?.message ?? "Failed to get link"); return; }
    window.open(data.signedUrl, "_blank");
  }

  async function review(d: DeliverableRow, status: DStatus) {
    const note = status !== "approved" ? prompt(`Note for "${status.replace("_", " ")}":`) : null;
    if (status !== "approved" && note === null) return;
    const { error } = await supabase
      .from("deliverables")
      .update({
        status,
        reviewer_id: user?.id ?? null,
        reviewer_note: note,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", d.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("notifications").insert({
      user_id: d.user_id,
      type: status === "approved" ? "task_assigned" : "warning",
      title: status === "approved" ? "✅ Deliverable approved" : status === "rejected" ? "❌ Deliverable rejected" : "🔄 Revision requested",
      message: `${d.file_name}${note ? ` — ${note}` : ""}`,
      related_task_id: d.task_id,
    });
    toast.success("Reviewed");
    void load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Deliverables</h1>
          <p className="text-sm text-muted-foreground">Submit work files (≤ 25MB) and review submissions.</p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <Tabs value={scope} onValueChange={(v) => setScope(v as "mine" | "all")}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="mine">Mine</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button><Upload className="mr-2 h-4 w-4" /> Submit File</Button>
            </DialogTrigger>
            <UploadDialog onUploaded={() => { setUploadOpen(false); void load(); }} />
          </Dialog>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No deliverables yet.</Card>
      ) : (
        <div className="grid gap-3">
          {items.map((d) => {
            const subj = profiles[d.user_id];
            return (
              <Card key={d.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{d.file_name}</p>
                      <span className={`text-[10px] uppercase tracking-wide rounded border px-1.5 py-0.5 ${STATUS_STYLE[d.status]}`}>
                        {d.status.replace("_", " ")}
                      </span>
                    </div>
                    {d.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{d.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5 flex-wrap">
                      <span>{fmtSize(d.file_size_bytes)}</span>
                      {isManager && subj && <span>By: {subj.full_name ?? subj.email}</span>}
                      <span>{timeAgo(d.created_at)}</span>
                    </div>
                    {d.reviewer_note && (
                      <p className="text-xs mt-2 rounded bg-muted/40 p-2 border border-border">
                        <span className="text-muted-foreground">Reviewer note:</span> {d.reviewer_note}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => downloadFile(d)}>
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                    {isManager && d.status === "submitted" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => review(d, "approved")} title="Approve">
                          <Check className="h-3.5 w-3.5 text-success" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => review(d, "revision_requested")} title="Request revision">
                          <RotateCcw className="h-3.5 w-3.5 text-warning" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => review(d, "rejected")} title="Reject">
                          <X className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UploadDialog({ onUploaded }: { onUploaded: () => void }) {
  const { user } = useAuth();
  const [tasks, setTasks] = React.useState<TaskMini[]>([]);
  const [file, setFile] = React.useState<File | null>(null);
  const [taskId, setTaskId] = React.useState<string>("");
  const [description, setDescription] = React.useState("");
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;
    void supabase
      .from("tasks").select("id, title")
      .eq("assigned_to", user.id)
      .neq("status", "completed")
      .order("due_date")
      .then(({ data }) => setTasks((data ?? []) as TaskMini[]));
  }, [user]);

  async function submit() {
    if (!file || !user) { toast.error("Pick a file"); return; }
    if (file.size > MAX_BYTES) { toast.error("File exceeds 25MB"); return; }
    setUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${Date.now()}_${safeName}`;
    const { error: upErr } = await supabase.storage.from("deliverables").upload(path, file, {
      contentType: file.type || "application/octet-stream",
    });
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    const { error } = await supabase.from("deliverables").insert({
      task_id: taskId || null,
      user_id: user.id,
      file_name: file.name,
      file_size_bytes: file.size,
      mime_type: file.type || null,
      storage_path: path,
      description: description.trim() || null,
    });
    if (error) {
      toast.error(error.message);
      await supabase.storage.from("deliverables").remove([path]);
      setUploading(false);
      return;
    }
    toast.success("Deliverable submitted");
    setUploading(false);
    onUploaded();
  }

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Submit Deliverable</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>File (max 25MB)</Label>
          <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          {file && <p className="text-xs text-muted-foreground mt-1">{fmtSize(file.size)}</p>}
        </div>
        <div>
          <Label>Linked task (optional)</Label>
          <Select value={taskId} onValueChange={setTaskId}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              {tasks.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Description</Label>
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's in this file?" />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={uploading || !file}>
          {uploading ? "Uploading…" : "Submit"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
