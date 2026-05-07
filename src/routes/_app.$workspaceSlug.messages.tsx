import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useRealtime } from "@/lib/use-realtime";
import { toast } from "sonner";
import {
  Send, Plus, Users, Pencil, Trash2, Check, X, Camera,
  UserPlus, Hash, Paperclip, FileText, Image as ImageIcon,
} from "lucide-react";
import { initialsOf } from "@/lib/nexus";
import { useWorkspace } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/$workspaceSlug/messages")({
  component: MessagesPage,
});

// ── Types ─────────────────────────────────────────────────────────────────────

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url?: string | null;
}

interface Msg {
  id: string;
  from_id: string;
  to_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
  edited_at?: string | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
}

interface Group {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  avatar_url?: string | null;
  members: Profile[];
  unread: number;
}

interface GroupMsg {
  id: string;
  group_id: string;
  from_id: string;
  body: string;
  created_at: string;
  edited_at?: string | null;
  sender: Profile | null;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
}

type View =
  | { type: "dm"; contact: Profile }
  | { type: "group"; group: Group };

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const wasYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (wasYesterday) return `Yesterday ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isGroupStart(messages: { from_id: string; created_at: string }[], idx: number) {
  if (idx === 0) return true;
  const prev = messages[idx - 1];
  const cur = messages[idx];
  if (prev.from_id !== cur.from_id) return true;
  return new Date(cur.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60_000;
}

// Render body text with auto-linked URLs and clickable @mentions
function MessageBody({ body }: { body: string }) {
  const parts = body.split(/(https?:\/\/[^\s]+|@\S+)/g);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.match(/^https?:\/\//)) {
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          );
        }
        if (part.startsWith("@")) {
          return (
            <a
              key={i}
              href="/team"
              className="font-semibold text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          );
        }
        return part;
      })}
    </span>
  );
}

// Upload avatar to storage, return public URL
async function uploadAvatar(bucket: string, path: string, file: File): Promise<string> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  // Cache bust
  return `${data.publicUrl}?t=${Date.now()}`;
}

// ── UserAvatar ────────────────────────────────────────────────────────────────

function UserAvatar({
  profile,
  size = "md",
  uploadable,
  onUploaded,
}: {
  profile: Profile | null;
  size?: "xs" | "sm" | "md" | "lg";
  uploadable?: boolean;
  onUploaded?: (url: string) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const sizeClass = {
    xs: "h-6 w-6 text-[9px]",
    sm: "h-8 w-8 text-[11px]",
    md: "h-9 w-9 text-xs",
    lg: "h-16 w-16 text-lg",
  }[size];

  const displayName = profile?.full_name ?? profile?.email ?? "?";

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    try {
      const url = await uploadAvatar("avatars", `user-${profile.id}`, file);
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", profile.id);
      onUploaded?.(url);
      toast.success("Profile picture updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const inner = profile?.avatar_url ? (
    <img
      src={profile.avatar_url}
      alt={displayName}
      className={cn("rounded-full object-cover", sizeClass)}
    />
  ) : (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary",
        sizeClass,
      )}
    >
      {initialsOf(displayName)}
    </div>
  );

  if (!uploadable) return inner;

  return (
    <div className="group relative cursor-pointer" onClick={() => inputRef.current?.click()}>
      {inner}
      <div className={cn(
        "absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100",
        sizeClass,
      )}>
        {uploading
          ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
          : <Camera className="h-3.5 w-3.5 text-white" />}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ── GroupAvatar ───────────────────────────────────────────────────────────────

function GroupAvatar({
  group,
  size = "md",
  uploadable,
  onUploaded,
}: {
  group: Group;
  size?: "xs" | "sm" | "md" | "lg";
  uploadable?: boolean;
  onUploaded?: (url: string) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);

  const sizeClass = {
    xs: "h-6 w-6 text-[9px]",
    sm: "h-8 w-8 text-[11px]",
    md: "h-9 w-9 text-xs",
    lg: "h-16 w-16 text-lg",
  }[size];

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAvatar("avatars", `group-${group.id}`, file);
      await supabase.from("message_groups").update({ avatar_url: url }).eq("id", group.id);
      onUploaded?.(url);
      toast.success("Group picture updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const inner = group.avatar_url ? (
    <img
      src={group.avatar_url}
      alt={group.name}
      className={cn("rounded-full object-cover", sizeClass)}
    />
  ) : (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground",
        sizeClass,
      )}
    >
      <Hash className="h-4 w-4" />
    </div>
  );

  if (!uploadable) return inner;

  return (
    <div className="group relative cursor-pointer" onClick={() => inputRef.current?.click()}>
      {inner}
      <div className={cn(
        "absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100",
        sizeClass,
      )}>
        {uploading
          ? <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
          : <Camera className="h-3.5 w-3.5 text-white" />}
      </div>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ── MessageRow ────────────────────────────────────────────────────────────────

function MessageRow({
  id,
  fromId,
  senderProfile,
  body,
  createdAt,
  editedAt,
  isStart,
  mine,
  onEdit,
  onDelete,
  attachmentUrl,
  attachmentName,
  attachmentMime,
}: {
  id: string;
  fromId: string;
  senderProfile: Profile | null;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  isStart: boolean;
  mine: boolean;
  onEdit: (id: string, newBody: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
}) {
  const [hovered, setHovered] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [editText, setEditText] = React.useState(body);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const editRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      editRef.current.selectionStart = editRef.current.value.length;
    }
  }, [editing]);

  async function saveEdit() {
    if (!editText.trim() || editText.trim() === body) { setEditing(false); return; }
    setSaving(true);
    await onEdit(id, editText.trim());
    setSaving(false);
    setEditing(false);
  }

  async function doDelete() {
    await onDelete(id);
    setConfirmDelete(false);
  }

  const displayName = senderProfile?.full_name ?? senderProfile?.email ?? "Unknown";

  return (
    <div
      className={cn("group relative flex gap-3 px-5 hover:bg-accent/30 transition-colors", isStart ? "mt-4 pt-1" : "mt-0.5")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirmDelete(false); }}
    >
      {/* Avatar column */}
      <div className="w-9 shrink-0">
        {isStart ? (
          <UserAvatar profile={senderProfile} size="sm" />
        ) : (
          <span className={cn(
            "block text-center text-[9px] text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors leading-[36px]",
          )}>
            {formatTime(createdAt).slice(0, 5)}
          </span>
        )}
      </div>

      {/* Body column */}
      <div className="flex-1 min-w-0">
        {isStart && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-sm font-semibold">{displayName}</span>
            <span className="text-[11px] text-muted-foreground">{formatTime(createdAt)}</span>
          </div>
        )}

        {editing ? (
          <div className="space-y-1">
            <textarea
              ref={editRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void saveEdit(); }
                if (e.key === "Escape") { setEditing(false); setEditText(body); }
              }}
              className="w-full resize-none rounded-md border border-border bg-background p-2 text-sm outline-none focus:ring-1 focus:ring-primary"
              rows={Math.min(6, editText.split("\n").length + 1)}
              disabled={saving}
            />
            <div className="flex gap-1.5 text-xs text-muted-foreground">
              <button
                onClick={() => void saveEdit()}
                disabled={saving}
                className="flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-primary-foreground hover:bg-primary/90"
              >
                <Check className="h-3 w-3" /> Save
              </button>
              <button
                onClick={() => { setEditing(false); setEditText(body); }}
                className="flex items-center gap-1 rounded px-2 py-0.5 hover:bg-accent"
              >
                <X className="h-3 w-3" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {body.trim() && (
              <p className="text-sm leading-relaxed">
                <MessageBody body={body} />
                {editedAt && (
                  <span className="ml-1 text-[10px] text-muted-foreground">(edited)</span>
                )}
              </p>
            )}
            {attachmentUrl && (
              <a
                href={attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm hover:bg-muted transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {attachmentMime?.startsWith("image/") ? (
                  <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate max-w-[180px]">{attachmentName ?? "Attachment"}</span>
              </a>
            )}
            {attachmentUrl && attachmentMime?.startsWith("image/") && (
              <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                <img
                  src={attachmentUrl}
                  alt={attachmentName ?? "image"}
                  className="mt-1 max-w-[280px] rounded-lg border border-border object-cover hover:opacity-90 transition-opacity"
                />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Hover actions */}
      {mine && !editing && hovered && (
        <div className="absolute right-5 top-1 flex items-center gap-0.5 rounded-md border border-border bg-background shadow-sm">
          <button
            onClick={() => { setEditing(true); setEditText(body); }}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {confirmDelete ? (
            <>
              <span className="px-1.5 text-xs text-destructive">Delete?</span>
              <button onClick={() => void doDelete()} className="rounded p-1.5 text-destructive hover:bg-destructive/10" title="Confirm">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setConfirmDelete(false)} className="rounded p-1.5 text-muted-foreground hover:bg-accent" title="Cancel">
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── MentionInput ──────────────────────────────────────────────────────────────

function MentionInput({
  value,
  onChange,
  onSend,
  placeholder,
  members,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder: string;
  members: Profile[];
  disabled?: boolean;
}) {
  const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);
  const [mentionStart, setMentionStart] = React.useState(0);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const suggestions = React.useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    const all: Profile[] = [{ id: "__all__", full_name: "all", email: null }];
    return [...all, ...members].filter((m) =>
      (m.full_name ?? m.email ?? "").toLowerCase().includes(q),
    );
  }, [mentionQuery, members]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;
    onChange(text);
    const cursor = e.target.selectionStart ?? text.length;
    const before = text.slice(0, cursor);
    const match = before.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionStart(cursor - match[0].length);
    } else {
      setMentionQuery(null);
    }
  }

  function pickMention(profile: Profile) {
    const name = profile.full_name ?? profile.email ?? "all";
    const before = value.slice(0, mentionStart);
    const after = value.slice(ref.current?.selectionStart ?? mentionStart + (mentionQuery?.length ?? 0) + 1);
    const newVal = `${before}@${name} ${after}`;
    onChange(newVal);
    setMentionQuery(null);
    setTimeout(() => {
      if (ref.current) {
        const pos = before.length + name.length + 2;
        ref.current.focus();
        ref.current.setSelectionRange(pos, pos);
      }
    }, 0);
  }

  return (
    <div className="relative">
      {suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 w-56 overflow-hidden rounded-lg border border-border bg-popover shadow-lg z-10">
          {suggestions.map((m) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); pickMention(m); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
            >
              {m.id === "__all__" ? (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
                  <Users className="h-3 w-3" />
                </div>
              ) : (
                <UserAvatar profile={m} size="xs" />
              )}
              <span>{m.full_name ?? m.email}</span>
              {m.id === "__all__" && <span className="ml-auto text-[10px] text-muted-foreground">everyone</span>}
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={ref}
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (mentionQuery !== null) return;
            onSend();
          }
        }}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        style={{ minHeight: "44px", maxHeight: "200px", overflowY: "auto" }}
        onInput={(e) => {
          const el = e.currentTarget;
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
        }}
      />
    </div>
  );
}

// ── GroupInfoSheet ────────────────────────────────────────────────────────────

function GroupInfoSheet({
  group,
  currentUserId,
  contacts,
  open,
  onClose,
  onGroupUpdated,
}: {
  group: Group;
  currentUserId: string;
  contacts: Profile[];
  open: boolean;
  onClose: () => void;
  onGroupUpdated: () => void;
}) {
  const { workspace } = useWorkspace();
  const isCreator = group.created_by === currentUserId;
  const memberIds = new Set(group.members.map((m) => m.id));
  const nonMembers = contacts.filter((c) => !memberIds.has(c.id));
  const [adding, setAdding] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);

  const toggleAdd = (id: string) =>
    setAdding((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  async function addMembers() {
    if (!adding.length) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("message_group_members")
        .insert(adding.map((uid) => ({ group_id: group.id, user_id: uid, workspace_id: workspace?.id })));
      if (error) throw error;
      toast.success(`${adding.length} member${adding.length > 1 ? "s" : ""} added`);
      setAdding([]);
      onGroupUpdated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add members");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-72 sm:w-80">
        <SheetHeader>
          <SheetTitle className="text-left">Group info</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-5">
          {/* Group avatar */}
          <div className="flex flex-col items-center gap-2">
            <GroupAvatar
              group={group}
              size="lg"
              uploadable={isCreator}
              onUploaded={() => onGroupUpdated()}
            />
            <p className="font-semibold">{group.name}</p>
            {isCreator && (
              <p className="text-[11px] text-muted-foreground">Click picture to change</p>
            )}
          </div>

          {/* Members */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Members ({group.members.length})
            </p>
            <div className="space-y-1">
              {group.members.map((m) => (
                <div key={m.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                  <UserAvatar profile={m} size="xs" />
                  <span className="text-sm">{m.full_name ?? m.email}</span>
                  {m.id === group.created_by && (
                    <span className="ml-auto text-[10px] text-muted-foreground">creator</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Add members */}
          {nonMembers.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Add members
              </p>
              <div className="max-h-40 overflow-y-auto space-y-0.5 rounded-lg border border-border p-1">
                {nonMembers.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded accent-primary"
                      checked={adding.includes(c.id)}
                      onChange={() => toggleAdd(c.id)}
                    />
                    <UserAvatar profile={c} size="xs" />
                    <span className="text-sm">{c.full_name ?? c.email}</span>
                  </label>
                ))}
              </div>
              {adding.length > 0 && (
                <Button
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => void addMembers()}
                  disabled={saving}
                >
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                  {saving ? "Adding…" : `Add ${adding.length} member${adding.length > 1 ? "s" : ""}`}
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── MessagesPage ──────────────────────────────────────────────────────────────

function MessagesPage() {
  const { user, profile: myProfile } = useAuth();
  const { workspace } = useWorkspace();
  const [contacts, setContacts] = React.useState<Profile[]>([]);
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [view, setView] = React.useState<View | null>(null);
  const [dmThread, setDmThread] = React.useState<Msg[]>([]);
  const [groupThread, setGroupThread] = React.useState<GroupMsg[]>([]);
  const [draft, setDraft] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [dmUnread, setDmUnread] = React.useState<Record<string, number>>({});
  const [createOpen, setCreateOpen] = React.useState(false);
  const [groupName, setGroupName] = React.useState("");
  const [pickedMembers, setPickedMembers] = React.useState<string[]>([]);
  const [creating, setCreating] = React.useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = React.useState(false);
  const [pendingFile, setPendingFile] = React.useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  // Me as Profile (for DM sender display)
  const meProfile: Profile | null = myProfile
    ? {
        id: (myProfile as { id: string }).id,
        full_name: (myProfile as { full_name: string | null }).full_name,
        email: (myProfile as { email: string | null }).email,
        avatar_url: (myProfile as { avatar_url?: string | null }).avatar_url,
      }
    : null;

  // ── Load contacts ──────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("id, full_name, email, avatar_url")
      .eq("is_active", true)
      .neq("id", user.id)
      .order("full_name")
      .then(({ data }) => setContacts((data ?? []) as Profile[]));
  }, [user]);

  // ── Load groups ────────────────────────────────────────────────────────────
  const loadGroups = React.useCallback(async () => {
    if (!user) return;

    let membershipQ = supabase
      .from("message_group_members")
      .select("group_id, last_read_at")
      .eq("user_id", user.id);
    if (workspace?.id) membershipQ = membershipQ.eq("workspace_id", workspace.id);
    const { data: myMemberships } = await membershipQ;

    if (!myMemberships?.length) { setGroups([]); return; }

    const groupIds = myMemberships.map((m) => m.group_id);
    const lastReadByGroup = Object.fromEntries(
      myMemberships.map((m) => [m.group_id, m.last_read_at]),
    );

    const [groupRes, memberRes, unreadRes] = await Promise.all([
      supabase
        .from("message_groups")
        .select("id, name, created_by, created_at, avatar_url")
        .in("id", groupIds)
        .order("created_at", { ascending: false }),
      supabase
        .from("message_group_members")
        .select("group_id, user_id, profiles(id, full_name, email, avatar_url)")
        .in("group_id", groupIds),
      supabase
        .from("group_messages")
        .select("group_id, created_at")
        .in("group_id", groupIds)
        .neq("from_id", user.id),
    ]);

    const unreadByGroup: Record<string, number> = {};
    for (const row of unreadRes.data ?? []) {
      const lr = lastReadByGroup[row.group_id];
      if (!lr || new Date(row.created_at) > new Date(lr)) {
        unreadByGroup[row.group_id] = (unreadByGroup[row.group_id] ?? 0) + 1;
      }
    }

    const membersByGroup: Record<string, Profile[]> = {};
    for (const row of memberRes.data ?? []) {
      const p = row.profiles as unknown as Profile | null;
      if (!p) continue;
      membersByGroup[row.group_id] ??= [];
      membersByGroup[row.group_id].push(p);
    }

    setGroups(
      (groupRes.data ?? []).map((g) => ({
        ...g,
        members: membersByGroup[g.id] ?? [],
        unread: unreadByGroup[g.id] ?? 0,
      })),
    );
  }, [user, workspace?.id]);

  React.useEffect(() => { void loadGroups(); }, [loadGroups]);

  // Sync active group when groups reload (e.g. after new member added)
  React.useEffect(() => {
    if (view?.type === "group") {
      const updated = groups.find((g) => g.id === view.group.id);
      if (updated) setView({ type: "group", group: updated });
    }
  }, [groups]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── DM unread ──────────────────────────────────────────────────────────────
  const loadDmUnread = React.useCallback(async () => {
    if (!user) return;
    let dmQ = supabase
      .from("direct_messages")
      .select("from_id")
      .eq("to_id", user.id)
      .eq("is_read", false);
    if (workspace?.id) dmQ = dmQ.eq("workspace_id", workspace.id);
    const { data } = await dmQ;
    const counts: Record<string, number> = {};
    (data ?? []).forEach((m: { from_id: string }) => {
      counts[m.from_id] = (counts[m.from_id] ?? 0) + 1;
    });
    setDmUnread(counts);
  }, [user, workspace?.id]);

  React.useEffect(() => { void loadDmUnread(); }, [loadDmUnread]);

  // ── Load DM thread ─────────────────────────────────────────────────────────
  const loadDmThread = React.useCallback(async () => {
    if (!user || view?.type !== "dm") return;
    const contact = view.contact;
    const { data } = await supabase
      .from("direct_messages")
      .select("*")
      .or(
        `and(from_id.eq.${user.id},to_id.eq.${contact.id}),and(from_id.eq.${contact.id},to_id.eq.${user.id})`,
      )
      .order("created_at", { ascending: true });
    setDmThread((data ?? []) as Msg[]);
    await supabase
      .from("direct_messages")
      .update({ is_read: true })
      .eq("from_id", contact.id)
      .eq("to_id", user.id)
      .eq("is_read", false);
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("type", "direct_message");
    void loadDmUnread();
  }, [user, view, loadDmUnread]);

  // ── Load group thread ──────────────────────────────────────────────────────
  const loadGroupThread = React.useCallback(async () => {
    if (!user || view?.type !== "group") return;
    const group = view.group;
    const { data } = await supabase
      .from("group_messages")
      .select("id, group_id, from_id, body, created_at, edited_at")
      .eq("group_id", group.id)
      .order("created_at", { ascending: true });

    const senderIds = [...new Set((data ?? []).map((m) => m.from_id))];
    const { data: profileRows } = senderIds.length
      ? await supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url")
          .in("id", senderIds)
      : { data: [] };
    const profileById = Object.fromEntries(
      (profileRows ?? []).map((p) => [p.id, p as Profile]),
    );

    setGroupThread(
      (data ?? []).map((m) => ({ ...m, sender: profileById[m.from_id] ?? null })),
    );

    await supabase
      .from("message_group_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("group_id", group.id)
      .eq("user_id", user.id);
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("type", "group_message");
    void loadGroups();
  }, [user, view, loadGroups]);

  React.useEffect(() => {
    if (view?.type === "dm") void loadDmThread();
    else if (view?.type === "group") void loadGroupThread();
  }, [view, loadDmThread, loadGroupThread]);

  // Scroll to bottom when conversation first loads; after that only if user is near bottom
  const viewId = React.useMemo(
    () => (view?.type === "dm" ? `dm-${view.contact.id}` : view?.type === "group" ? `grp-${view.group.id}` : null),
    [view],
  );
  const prevViewIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!viewId) return;
    const isNewConversation = viewId !== prevViewIdRef.current;
    prevViewIdRef.current = viewId;
    if (isNewConversation) {
      // Immediate scroll when switching conversations
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "instant" }), 0);
      return;
    }
    // For realtime updates, only scroll if user is already near bottom
    const el = scrollAreaRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (nearBottom) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [dmThread, groupThread, viewId]);

  // ── Realtime ───────────────────────────────────────────────────────────────
  useRealtime({
    table: "direct_messages",
    filter: user ? `to_id=eq.${user.id}` : undefined,
    enabled: !!user,
    onChange: () => { void loadDmThread(); void loadDmUnread(); },
  });
  useRealtime({
    table: "group_messages",
    enabled: !!user,
    onChange: () => { void loadGroupThread(); void loadGroups(); },
  });
  useRealtime({
    table: "message_group_members",
    filter: user ? `user_id=eq.${user.id}` : undefined,
    enabled: !!user,
    onChange: () => void loadGroups(),
  });

  // ── Send ───────────────────────────────────────────────────────────────────
  async function send() {
    if (!draft.trim() && !pendingFile) return;
    if (!user) return;
    setSending(true);

    // Upload file if attached
    let attachmentUrl: string | null = null;
    let attachmentName: string | null = null;
    let attachmentMime: string | null = null;
    if (pendingFile) {
      setUploadingFile(true);
      const safeName = pendingFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("message-attachments")
        .upload(path, pendingFile, { contentType: pendingFile.type || "application/octet-stream" });
      setUploadingFile(false);
      if (upErr) { toast.error(upErr.message); setSending(false); return; }
      const { data: urlData } = supabase.storage.from("message-attachments").getPublicUrl(path);
      attachmentUrl = urlData.publicUrl;
      attachmentName = pendingFile.name;
      attachmentMime = pendingFile.type || null;
      setPendingFile(null);
    }

    // Force scroll to bottom when sending
    prevViewIdRef.current = null;

    if (view?.type === "dm") {
      const { error } = await supabase.from("direct_messages").insert({
        from_id: user.id,
        to_id: view.contact.id,
        body: draft.trim(),
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
        attachment_mime: attachmentMime,
        workspace_id: workspace?.id,
      });
      if (error) { toast.error(error.message); setSending(false); return; }
      void loadDmThread();
    } else if (view?.type === "group") {
      const { error } = await supabase.from("group_messages").insert({
        group_id: view.group.id,
        from_id: user.id,
        body: draft.trim(),
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
        attachment_mime: attachmentMime,
        workspace_id: workspace?.id,
      });
      if (error) { toast.error(error.message); setSending(false); return; }
      void loadGroupThread();
    }
    setDraft("");
    setSending(false);
  }

  // ── Edit / Delete DM ───────────────────────────────────────────────────────
  async function editDm(id: string, body: string) {
    const { error } = await supabase
      .from("direct_messages")
      .update({ body, edited_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else void loadDmThread();
  }

  async function deleteDm(id: string) {
    const { error } = await supabase.from("direct_messages").delete().eq("id", id);
    if (error) toast.error(error.message);
    else void loadDmThread();
  }

  // ── Edit / Delete group message ────────────────────────────────────────────
  async function editGroupMsg(id: string, body: string) {
    const { error } = await supabase
      .from("group_messages")
      .update({ body, edited_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast.error(error.message);
    else void loadGroupThread();
  }

  async function deleteGroupMsg(id: string) {
    const { error } = await supabase.from("group_messages").delete().eq("id", id);
    if (error) toast.error(error.message);
    else void loadGroupThread();
  }

  // ── Create group ───────────────────────────────────────────────────────────
  async function createGroup() {
    if (!groupName.trim() || !user) return;
    setCreating(true);
    try {
      const { data: grp, error: grpErr } = await supabase
        .from("message_groups")
        .insert({ name: groupName.trim(), created_by: user.id, workspace_id: workspace?.id })
        .select("id")
        .single();
      if (grpErr) throw new Error(grpErr.message);

      const memberIds = Array.from(new Set([user.id, ...pickedMembers]));
      const { error: memErr } = await supabase
        .from("message_group_members")
        .insert(memberIds.map((uid) => ({ group_id: grp.id, user_id: uid, workspace_id: workspace?.id })));
      if (memErr) throw new Error(memErr.message);

      toast.success(`Group "${groupName.trim()}" created`);
      setCreateOpen(false);
      setGroupName("");
      setPickedMembers([]);
      await loadGroups();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setCreating(false);
    }
  }

  const toggleMember = (id: string) =>
    setPickedMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  // ── Render ─────────────────────────────────────────────────────────────────
  const activeGroup = view?.type === "group" ? view.group : null;

  return (
    <>
      <div className="flex h-[calc(100vh-8rem)] md:h-[calc(100vh-7rem)] gap-0 overflow-hidden rounded-xl border border-border">
        {/* ── Sidebar — full-width on mobile when no chat open ─────────────── */}
        <aside className={`border-b md:border-b-0 md:border-r border-border flex flex-col md:w-64 md:shrink-0 ${view ? "hidden md:flex" : "flex w-full"}`}>
          <div className="border-b border-border p-4 flex items-center justify-between">
            <h2 className="font-semibold">Messages</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {/* Direct Messages */}
            <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Direct Messages
            </p>
            {contacts.map((c) => (
              <button
                key={c.id}
                onClick={() => { setView({ type: "dm", contact: c }); setDraft(""); }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-accent",
                  view?.type === "dm" && view.contact.id === c.id && "bg-accent",
                )}
              >
                <UserAvatar profile={c} size="xs" />
                <span className="min-w-0 flex-1 truncate text-sm">{c.full_name ?? c.email}</span>
                {(dmUnread[c.id] ?? 0) > 0 && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {dmUnread[c.id]}
                  </span>
                )}
              </button>
            ))}
            {contacts.length === 0 && (
              <p className="px-4 py-2 text-xs text-muted-foreground">No team members yet.</p>
            )}

            {/* Groups */}
            <div className="flex items-center justify-between px-4 pb-1 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Groups
              </p>
              <button
                onClick={() => setCreateOpen(true)}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
                title="New group"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => { setView({ type: "group", group: g }); setDraft(""); }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-4 py-2 text-left transition-colors hover:bg-accent",
                  view?.type === "group" && view.group.id === g.id && "bg-accent",
                )}
              >
                <GroupAvatar group={g} size="xs" />
                <span className="min-w-0 flex-1 truncate text-sm">{g.name}</span>
                {g.unread > 0 && (
                  <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {g.unread}
                  </span>
                )}
              </button>
            ))}
            {groups.length === 0 && (
              <p className="px-4 py-2 text-xs text-muted-foreground">
                No groups yet.{" "}
                <button onClick={() => setCreateOpen(true)} className="text-primary hover:underline">
                  Create one
                </button>
              </p>
            )}
          </div>
        </aside>

        {/* ── Thread panel — full-width on mobile when chat open ────────────── */}
        <div className={`min-w-0 flex-1 flex-col ${!view ? "hidden md:flex" : "flex"}`}>
          {view ? (
            <>
              {/* Header */}
              <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 md:px-5 py-3">
                {/* Mobile back button */}
                <button
                  className="flex items-center gap-1 text-xs text-muted-foreground md:hidden shrink-0"
                  onClick={() => { setView(null); setDraft(""); }}
                >
                  ← Back
                </button>
                {view.type === "dm" ? (
                  <UserAvatar profile={view.contact} size="sm" />
                ) : (
                  <GroupAvatar group={view.group} size="sm" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold leading-tight truncate">
                    {view.type === "dm"
                      ? (view.contact.full_name ?? view.contact.email)
                      : view.group.name}
                  </p>
                  {view.type === "group" && (
                    <button
                      onClick={() => setGroupInfoOpen(true)}
                      className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {view.group.members.length} member{view.group.members.length !== 1 ? "s" : ""} · click to manage
                    </button>
                  )}
                </div>
                {view.type === "group" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setGroupInfoOpen(true)}
                    className="h-7 text-xs"
                  >
                    <Users className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              {/* Messages */}
              <div ref={scrollAreaRef} className="flex-1 overflow-y-auto py-2">
                {view.type === "dm" && dmThread.length === 0 && (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No messages yet. Say hello!
                  </p>
                )}
                {view.type === "group" && groupThread.length === 0 && (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No messages yet. Start the conversation!
                  </p>
                )}

                {view.type === "dm" &&
                  dmThread.map((m, i) => (
                    <MessageRow
                      key={m.id}
                      id={m.id}
                      fromId={m.from_id}
                      senderProfile={m.from_id === user?.id ? meProfile : view.contact}
                      body={m.body}
                      createdAt={m.created_at}
                      editedAt={m.edited_at}
                      isStart={isGroupStart(dmThread, i)}
                      mine={m.from_id === user?.id}
                      onEdit={editDm}
                      onDelete={deleteDm}
                      attachmentUrl={m.attachment_url}
                      attachmentName={m.attachment_name}
                      attachmentMime={m.attachment_mime}
                    />
                  ))}

                {view.type === "group" &&
                  groupThread.map((m, i) => (
                    <MessageRow
                      key={m.id}
                      id={m.id}
                      fromId={m.from_id}
                      senderProfile={m.sender}
                      body={m.body}
                      createdAt={m.created_at}
                      editedAt={m.edited_at}
                      isStart={isGroupStart(groupThread, i)}
                      mine={m.from_id === user?.id}
                      onEdit={editGroupMsg}
                      onDelete={deleteGroupMsg}
                      attachmentUrl={m.attachment_url}
                      attachmentName={m.attachment_name}
                      attachmentMime={m.attachment_mime}
                    />
                  ))}

                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="shrink-0 border-t border-border px-4 py-3">
                {pendingFile && (
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
                    {pendingFile.type.startsWith("image/") ? (
                      <ImageIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate flex-1">{pendingFile.name}</span>
                    <button onClick={() => setPendingFile(null)} className="text-muted-foreground hover:text-destructive">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={sending || uploadingFile}
                    className="flex h-11 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors disabled:opacity-50"
                    title="Attach file"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => { setPendingFile(e.target.files?.[0] ?? null); e.target.value = ""; }}
                  />
                  <div className="flex-1">
                    <MentionInput
                      value={draft}
                      onChange={setDraft}
                      onSend={() => void send()}
                      placeholder={
                        view.type === "dm"
                          ? `Message ${view.contact.full_name ?? view.contact.email}…`
                          : `Message #${view.group.name}… (type @ to mention)`
                      }
                      members={view.type === "group" ? view.group.members.filter((m) => m.id !== user?.id) : []}
                      disabled={sending || uploadingFile}
                    />
                  </div>
                  <Button
                    onClick={() => void send()}
                    disabled={sending || uploadingFile || (!draft.trim() && !pendingFile)}
                    size="icon"
                    className="h-11 w-11 shrink-0"
                  >
                    {uploadingFile ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Enter to send · Shift+Enter for new line{view.type === "group" ? " · @ to mention" : ""}
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Send className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium">Select a conversation</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Or{" "}
                  <button onClick={() => setCreateOpen(true)} className="text-primary hover:underline">
                    create a group
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Create group dialog ──────────────────────────────────────────────── */}
      <Dialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o);
          if (!o) { setGroupName(""); setPickedMembers([]); }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Group name</label>
              <Input
                className="mt-1"
                placeholder="e.g. Design team"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") void createGroup(); }}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Add members</label>
              <div className="mt-2 max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-border p-1">
                {contacts.map((c) => (
                  <label
                    key={c.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded accent-primary"
                      checked={pickedMembers.includes(c.id)}
                      onChange={() => toggleMember(c.id)}
                    />
                    <UserAvatar profile={c} size="xs" />
                    <span className="text-sm">{c.full_name ?? c.email}</span>
                  </label>
                ))}
                {contacts.length === 0 && (
                  <p className="px-2 py-1 text-xs text-muted-foreground">No other members.</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => void createGroup()} disabled={creating || !groupName.trim()}>
              {creating ? "Creating…" : "Create group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Group info sheet ─────────────────────────────────────────────────── */}
      {activeGroup && user && (
        <GroupInfoSheet
          group={activeGroup}
          currentUserId={user.id}
          contacts={contacts}
          open={groupInfoOpen}
          onClose={() => setGroupInfoOpen(false)}
          onGroupUpdated={() => void loadGroups()}
        />
      )}
    </>
  );
}
