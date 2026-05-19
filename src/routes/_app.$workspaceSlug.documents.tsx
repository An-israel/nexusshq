import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { timeAgo } from "@/lib/nexus";
import { cn } from "@/lib/utils";
import { FileText, Upload, ExternalLink, PenLine, Lock, FolderOpen } from "lucide-react";

export const Route = createFileRoute("/_app/$workspaceSlug/documents")({
  component: DocumentsPage,
});

type DocType = "offer_letter" | "contract" | "nda" | "policy" | "payslip" | "other";

const DOC_TYPE_LABEL: Record<DocType, string> = {
  offer_letter: "Offer Letter",
  contract: "Contract",
  nda: "NDA",
  policy: "Policy",
  payslip: "Payslip",
  other: "Document",
};

const DOC_TYPE_COLOR: Record<DocType, string> = {
  offer_letter: "bg-green-500/15 text-green-600",
  contract: "bg-blue-500/15 text-blue-600",
  nda: "bg-orange-500/15 text-orange-600",
  policy: "bg-purple-500/15 text-purple-600",
  payslip: "bg-primary/15 text-primary",
  other: "bg-muted text-muted-foreground",
};

interface DocumentRow {
  id: string;
  workspace_id: string;
  user_id: string;
  uploaded_by: string;
  title: string;
  file_url: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  doc_type: DocType;
  requires_signature: boolean;
  signed_at: string | null;
  signature_text: string | null;
  created_at: string;
}

interface ProfileMini {
  id: string;
  full_name: string | null;
  email: string | null;
}

function fmtBytes(b: number | null) {
  if (!b) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentsPage() {
  const { user, isManager } = useAuth();
  const { workspace } = useWorkspace();
  const [docs, setDocs] = React.useState<DocumentRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [signDoc, setSignDoc] = React.useState<DocumentRow | null>(null);
  const [sigName, setSigName] = React.useState("");
  const [signing, setSigning] = React.useState(false);
  const [employees, setEmployees] = React.useState<ProfileMini[]>([]);

  // Upload form
  const [uploadForm, setUploadForm] = React.useState({
    userId: "",
    title: "",
    docType: "other" as DocType,
    requiresSignature: false,
    file: null as File | null,
  });
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    setDocs((data ?? []) as DocumentRow[]);
    setLoading(false);
  }, [workspace.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!isManager) return;
    void supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_active", true)
      .order("full_name")
      .then(({ data }) => setEmployees((data ?? []) as ProfileMini[]));
  }, [isManager]);

  async function handleUpload() {
    if (!uploadForm.file) return toast.error("Select a file first");
    if (!uploadForm.userId) return toast.error("Pick an employee");
    if (!uploadForm.title.trim()) return toast.error("Enter a document title");

    const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
    if (uploadForm.file.size > MAX_BYTES) {
      return toast.error(
        `File is too large (${fmtBytes(uploadForm.file.size)}). Maximum is 20 MB.`,
      );
    }

    setUploading(true);
    setUploadProgress(0);
    const uploadToastId = toast.loading("Uploading document…");
    try {
      const ext = uploadForm.file.name.split(".").pop() ?? "bin";
      const path = `${workspace.id}/${uploadForm.userId}/${Date.now()}.${ext}`;

      // Simulate progress steps since Supabase storage doesn't expose upload progress
      const progressTick = setInterval(() => {
        setUploadProgress((p) => Math.min(p + 10, 80));
      }, 200);

      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, uploadForm.file, { upsert: false });

      clearInterval(progressTick);
      setUploadProgress(90);

      if (upErr) {
        if (upErr.message.includes("Bucket not found")) {
          throw new Error(
            'Storage bucket "documents" not found. Ask your admin to create it in Supabase Storage.',
          );
        }
        if (upErr.message.includes("row-level security")) {
          throw new Error("Upload blocked by storage policy. Contact your admin.");
        }
        throw upErr;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("documents").getPublicUrl(path);

      const { error: dbErr } = await supabase.from("documents").insert({
        workspace_id: workspace.id,
        user_id: uploadForm.userId,
        uploaded_by: user!.id,
        title: uploadForm.title.trim(),
        file_url: publicUrl,
        file_size_bytes: uploadForm.file.size,
        mime_type: uploadForm.file.type,
        doc_type: uploadForm.docType,
        requires_signature: uploadForm.requiresSignature,
      });
      if (dbErr) throw dbErr;

      // Notify employee (non-blocking — don't fail upload if notification fails)
      void supabase.from("notifications").insert({
        user_id: uploadForm.userId,
        workspace_id: workspace.id,
        type: "flag",
        title: "📄 New document",
        message: `"${uploadForm.title}" has been added to your document vault.`,
      });

      setUploadProgress(100);
      toast.dismiss(uploadToastId);
      toast.success(`"${uploadForm.title.trim()}" uploaded successfully`);
      setUploadOpen(false);
      setUploadForm({
        userId: "",
        title: "",
        docType: "other",
        requiresSignature: false,
        file: null,
      });
      void load();
    } catch (err) {
      toast.dismiss(uploadToastId);
      toast.error((err as Error).message ?? "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  async function handleSign() {
    if (!signDoc) return;
    if (!sigName.trim()) return toast.error("Enter your name to sign");
    setSigning(true);
    const { error } = await supabase
      .from("documents")
      .update({
        signed_at: new Date().toISOString(),
        signature_text: sigName.trim(),
      })
      .eq("id", signDoc.id);
    if (error) {
      toast.error(error.message);
      setSigning(false);
      return;
    }
    toast.success("Document signed");
    setSignDoc(null);
    setSigName("");
    setSigning(false);
    void load();
  }

  const myDocs = isManager ? docs : docs.filter((d) => d.user_id === user?.id);
  const pendingSig = myDocs.filter((d) => d.requires_signature && !d.signed_at).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Document Vault</h1>
          <p className="text-sm text-muted-foreground">
            {isManager
              ? "Manage team documents and contracts."
              : "Your personal documents and contracts."}
          </p>
        </div>
        {isManager && (
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Upload Document
          </Button>
        )}
      </div>

      {/* Pending signature banner */}
      {!isManager && pendingSig > 0 && (
        <div className="flex items-center gap-3 rounded-xl bg-warning/10 border border-warning/30 p-4">
          <PenLine className="h-5 w-5 text-warning shrink-0" />
          <p className="text-sm font-medium text-warning">
            {pendingSig} document{pendingSig > 1 ? "s" : ""} require{pendingSig === 1 ? "s" : ""}{" "}
            your signature
          </p>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Employee</Label>
              <Select
                value={uploadForm.userId}
                onValueChange={(v) => setUploadForm((f) => ({ ...f, userId: v }))}
              >
                <SelectTrigger className="text-base md:text-sm">
                  <SelectValue placeholder="Pick employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name ?? e.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title</Label>
              <Input
                className="text-base md:text-sm"
                placeholder="e.g. Employment Contract 2025"
                value={uploadForm.title}
                onChange={(e) => setUploadForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div>
              <Label>Type</Label>
              <Select
                value={uploadForm.docType}
                onValueChange={(v) => setUploadForm((f) => ({ ...f, docType: v as DocType }))}
              >
                <SelectTrigger className="text-base md:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DOC_TYPE_LABEL) as DocType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {DOC_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>File (PDF, DOCX, image)</Label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                className="text-base md:text-sm"
                onChange={(e) =>
                  setUploadForm((f) => ({ ...f, file: e.target.files?.[0] ?? null }))
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="req-sig"
                checked={uploadForm.requiresSignature}
                onChange={(e) =>
                  setUploadForm((f) => ({ ...f, requiresSignature: e.target.checked }))
                }
                className="h-4 w-4"
              />
              <Label htmlFor="req-sig" className="cursor-pointer">
                Requires employee signature
              </Label>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2">
            {uploading && uploadProgress > 0 && (
              <div className="w-full">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1 text-right">{uploadProgress}%</p>
              </div>
            )}
            <Button onClick={handleUpload} disabled={uploading} className="w-full sm:w-auto">
              <Upload className="mr-2 h-4 w-4" />
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sign Sheet */}
      <Sheet open={!!signDoc} onOpenChange={(o) => !o && setSignDoc(null)}>
        <SheetContent side="bottom" className="rounded-t-[20px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <PenLine className="h-4 w-4" />
              Sign Document
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              You are signing: <span className="font-medium text-foreground">{signDoc?.title}</span>
            </p>
            <div>
              <Label>Type your full name to sign</Label>
              <Input
                className="text-base md:text-sm"
                placeholder="Your full name"
                value={sigName}
                onChange={(e) => setSigName(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              By signing, you confirm you have read and agree to this document.
            </p>
            <Button className="w-full" onClick={handleSign} disabled={signing}>
              <PenLine className="mr-2 h-4 w-4" />
              {signing ? "Signing…" : "Sign Document"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Document grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-4 w-3/4 rounded" />
              <Skeleton className="h-3 w-1/2 rounded" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : myDocs.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <FolderOpen className="h-14 w-14 text-muted-foreground/30" />
          <p className="text-base font-medium text-muted-foreground">No documents yet</p>
          {isManager && (
            <p className="text-sm text-muted-foreground">
              Upload the first document for your team.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {myDocs.map((doc) => (
            <Card
              key={doc.id}
              className="p-5 space-y-3 hover:shadow-md transition-shadow flex flex-col"
            >
              {/* Icon + type badge */}
              <div className="flex items-start justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    DOC_TYPE_COLOR[doc.doc_type],
                  )}
                >
                  {DOC_TYPE_LABEL[doc.doc_type]}
                </span>
              </div>

              {/* Title + meta */}
              <div className="flex-1">
                <p className="font-semibold text-sm leading-snug">{doc.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {fmtBytes(doc.file_size_bytes)} · {timeAgo(doc.created_at)}
                </p>
              </div>

              {/* Signature status */}
              {doc.requires_signature && (
                <div
                  className={cn(
                    "flex items-center gap-1.5 text-xs font-medium",
                    doc.signed_at ? "text-success" : "text-warning",
                  )}
                >
                  {doc.signed_at ? (
                    <>
                      <Lock className="h-3.5 w-3.5" /> Signed{" "}
                      {doc.signature_text ? `by ${doc.signature_text}` : ""}
                    </>
                  ) : (
                    <>
                      <PenLine className="h-3.5 w-3.5" /> Signature required
                    </>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(doc.file_url, "_blank")}
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> View
                </Button>
                {doc.requires_signature && !doc.signed_at && doc.user_id === user?.id && (
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setSignDoc(doc);
                      setSigName("");
                    }}
                  >
                    <PenLine className="mr-1.5 h-3.5 w-3.5" /> Sign
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
