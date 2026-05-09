import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { MsgProfile } from "@/lib/messaging/types";

interface WorkspaceMember {
  user_id: string;
  profile: MsgProfile | null;
}

function sanitizeChannelName(value: string): string {
  return value
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "");
}

function initialsOf(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hashColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 40%)`;
}

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  userId: string;
  onCreated: (channelId: string) => void;
}

export function CreateChannelModal({ open, onClose, workspaceId, userId, onCreated }: Props) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<"public" | "private">("public");
  const [memberSearch, setMemberSearch] = React.useState("");
  const [allMembers, setAllMembers] = React.useState<WorkspaceMember[]>([]);
  const [selectedUserIds, setSelectedUserIds] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setName("");
      setDescription("");
      setType("public");
      setMemberSearch("");
      setSelectedUserIds(new Set());
      setError(null);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open || type !== "private" || allMembers.length > 0) return;
    async function loadMembers() {
      const { data } = await supabase
        .from("workspace_members")
        .select("user_id, profiles(id, full_name, email, avatar_url, department, job_title)")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true);

      if (!data) return;
      const parsed: WorkspaceMember[] = data
        .filter((row) => row.user_id !== userId)
        .map((row) => ({
          user_id: row.user_id,
          profile: Array.isArray(row.profiles) ? (row.profiles[0] ?? null) : (row.profiles as MsgProfile | null),
        }));
      setAllMembers(parsed);
    }
    loadMembers();
  }, [open, type, workspaceId, userId, allMembers.length]);

  const filteredMembers = React.useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return allMembers;
    return allMembers.filter(
      (m) =>
        m.profile?.full_name?.toLowerCase().includes(q) ||
        m.profile?.email?.toLowerCase().includes(q)
    );
  }, [allMembers, memberSearch]);

  function toggleMember(uid: string) {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  function validate(): string | null {
    const trimmed = name.trim();
    if (!trimmed) return "Channel name is required.";
    if (trimmed.length < 2) return "Channel name must be at least 2 characters.";
    if (trimmed.length > 80) return "Channel name must be 80 characters or fewer.";
    return null;
  }

  async function handleCreate() {
    const err = validate();
    if (err) { setError(err); return; }
    setLoading(true);
    setError(null);
    try {
      const { data: channel, error: chErr } = await supabase
        .from("channels")
        .insert({
          workspace_id: workspaceId,
          name: name.trim(),
          description: description.trim() || null,
          type,
          created_by: userId,
          is_default: false,
          is_archived: false,
        })
        .select("id")
        .single();

      if (chErr) throw chErr;

      const memberInserts: { channel_id: string; user_id: string; workspace_id: string; role: string }[] = [
        { channel_id: channel.id, user_id: userId, workspace_id: workspaceId, role: "admin" },
      ];

      if (type === "private") {
        for (const uid of selectedUserIds) {
          memberInserts.push({ channel_id: channel.id, user_id: uid, workspace_id: workspaceId, role: "member" });
        }
      }

      const { error: memErr } = await supabase.from("channel_members").insert(memberInserts);
      if (memErr) throw memErr;

      onCreated(channel.id);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create channel";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-md p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#2A2A2A]">
          <DialogTitle className="text-white text-base font-semibold">Create a channel</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#9CA3AF] font-medium">Channel name</label>
            <Input
              value={name}
              onChange={(e) => setName(sanitizeChannelName(e.target.value))}
              placeholder="e.g. project-alpha"
              maxLength={80}
              className="bg-[#111111] border-[#2A2A2A] text-white placeholder:text-[#4B5563] h-9"
            />
            {name && (
              <p className="text-xs text-[#6B7280]">
                # {name || "channel-name"}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#9CA3AF] font-medium">
              Description <span className="text-[#6B7280] font-normal">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this channel about?"
              rows={2}
              className={cn(
                "resize-none rounded-md px-3 py-2 text-sm bg-[#111111] border border-[#2A2A2A]",
                "text-white placeholder:text-[#4B5563] outline-none focus:ring-1 focus:ring-[#3B3B3B]",
                "transition-colors"
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-[#9CA3AF] font-medium">Channel type</label>
            <div className="flex gap-3">
              {(["public", "private"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "flex-1 py-2 rounded-md text-sm font-medium border transition-colors",
                    type === t
                      ? "bg-[#2A2A2A] border-[#4B5563] text-white"
                      : "bg-transparent border-[#2A2A2A] text-[#9CA3AF] hover:bg-[#1E1E1E] hover:text-white"
                  )}
                >
                  {t === "public" ? "Public" : "Private"}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-[#6B7280]">
              {type === "public"
                ? "Anyone in the workspace can join."
                : "Only invited members can see and join this channel."}
            </p>
          </div>

          {type === "private" && (
            <div className="flex flex-col gap-2">
              <label className="text-xs text-[#9CA3AF] font-medium">Add members</label>
              <Input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="bg-[#111111] border-[#2A2A2A] text-white placeholder:text-[#4B5563] h-8 text-sm"
              />
              {filteredMembers.length > 0 && (
                <div className="max-h-40 overflow-y-auto border border-[#2A2A2A] rounded-md bg-[#111111]">
                  {filteredMembers.map((m) => {
                    const checked = selectedUserIds.has(m.user_id);
                    const displayName = m.profile?.full_name ?? m.profile?.email ?? m.user_id;
                    const pid = m.profile?.id ?? m.user_id;
                    return (
                      <label
                        key={m.user_id}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 cursor-pointer",
                          "hover:bg-[#1E1E1E] transition-colors"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleMember(m.user_id)}
                          className="accent-white"
                        />
                        {m.profile?.avatar_url ? (
                          <img
                            src={m.profile.avatar_url}
                            alt={displayName}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0"
                            style={{ backgroundColor: hashColor(pid) }}
                          >
                            {initialsOf(m.profile?.full_name ?? null)}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-white truncate">{displayName}</span>
                          {m.profile?.department && (
                            <span className="text-[10px] text-[#6B7280] truncate">{m.profile.department}</span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
              {selectedUserIds.size > 0 && (
                <p className="text-[11px] text-[#9CA3AF]">
                  {selectedUserIds.size} member{selectedUserIds.size !== 1 ? "s" : ""} selected
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
        </div>

        <div className="px-6 pb-6 flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={loading}
            className="text-[#9CA3AF] hover:text-white hover:bg-[#2A2A2A]"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="bg-white text-[#111111] hover:bg-[#E5E7EB] font-medium"
          >
            {loading ? "Creating..." : "Create channel"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
