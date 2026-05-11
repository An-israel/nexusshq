import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { MsgProfile } from "@/lib/messaging/types";

function hashColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 40%)`;
}

function initialsOf(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  currentUserId: string;
  onStarted: (conversationId: string) => void;
  startDm: (userIds: string[]) => Promise<string>;
}

export function NewDmModal({ open, onClose, workspaceId, currentUserId, onStarted, startDm }: Props) {
  const [search, setSearch] = React.useState("");
  const [results, setResults] = React.useState<MsgProfile[]>([]);
  const [selected, setSelected] = React.useState<MsgProfile[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [highlightedIdx, setHighlightedIdx] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) {
      setSearch("");
      setResults([]);
      setSelected([]);
      setHighlightedIdx(0);
    } else {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  React.useEffect(() => {
    setHighlightedIdx(0);
  }, [results]);

  React.useEffect(() => {
    const q = search.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);

    const timer = setTimeout(async () => {
      const selectedIds = new Set(selected.map((s) => s.id));
      selectedIds.add(currentUserId);

      // First try workspace_members join; fall back to profiles directly if empty
      const { data: wmData } = await supabase
        .from("workspace_members")
        .select("user_id, profiles(id, full_name, email, avatar_url, department, job_title, is_active)")
        .eq("workspace_id", workspaceId);

      if (cancelled) { setSearching(false); return; }

      const lowerQ = q.toLowerCase();
      let profiles: MsgProfile[] = [];

      if (wmData && wmData.length > 0) {
        profiles = wmData
          .filter((row) => !selectedIds.has(row.user_id))
          .map((row) =>
            Array.isArray(row.profiles) ? (row.profiles[0] ?? null) : (row.profiles as MsgProfile | null)
          )
          .filter((p): p is MsgProfile & { is_active?: boolean } => !!p && p.is_active !== false)
          .filter(
            (p) =>
              p.full_name?.toLowerCase().includes(lowerQ) ||
              p.email?.toLowerCase().includes(lowerQ)
          );
      }

      // Fallback: workspace_members empty or user not enrolled — query profiles directly
      if (profiles.length === 0) {
        const { data: profData } = await supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url, department, job_title")
          .eq("is_active", true)
          .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
          .limit(20);
        if (cancelled) { setSearching(false); return; }
        profiles = (profData ?? [])
          .filter((p) => !selectedIds.has(p.id)) as unknown as MsgProfile[];
      }

      setResults(profiles);
      setSearching(false);
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, selected, workspaceId, currentUserId]);

  function addPerson(profile: MsgProfile) {
    setSelected((prev) => {
      if (prev.find((p) => p.id === profile.id)) return prev;
      return [...prev, profile];
    });
    setSearch("");
    setResults([]);
    inputRef.current?.focus();
  }

  function removePerson(id: string) {
    setSelected((prev) => prev.filter((p) => p.id !== id));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[highlightedIdx]) addPerson(results[highlightedIdx]);
      else if (selected.length > 0) handleStart();
    } else if (e.key === "Backspace" && !search && selected.length > 0) {
      removePerson(selected[selected.length - 1].id);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  async function handleStart() {
    if (selected.length === 0 || starting) return;
    setStarting(true);
    try {
      const id = await startDm(selected.map((p) => p.id));
      onStarted(id);
      onClose();
    } catch {
      // silently fail
    } finally {
      setStarting(false);
    }
  }

  const buttonLabel =
    selected.length === 0
      ? "Select people"
      : selected.length === 1
        ? "Open direct message"
        : "Start group message";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="bg-[#1A1A1A] border border-[#2A2A2A] text-white max-w-md p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#2A2A2A]">
          <DialogTitle className="text-white text-base font-semibold">New message</DialogTitle>
        </DialogHeader>

        <div className="px-4 py-3 border-b border-[#2A2A2A]">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-xs text-[#9CA3AF] shrink-0">To:</span>
            {selected.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 bg-[#2A2A2A] text-white text-xs rounded-md px-2 py-1"
              >
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt={p.full_name ?? ""} className="w-4 h-4 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-semibold"
                    style={{ backgroundColor: hashColor(p.id) }}
                  >
                    {initialsOf(p.full_name)}
                  </div>
                )}
                {p.full_name ?? p.email}
                <button
                  type="button"
                  onClick={() => removePerson(p.id)}
                  className="text-[#6B7280] hover:text-white transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selected.length === 0 ? "Search for people..." : "Add more people..."}
              className="flex-1 min-w-24 bg-transparent text-sm text-white placeholder:text-[#4B5563] outline-none"
            />
          </div>
        </div>

        <div className="min-h-[200px] max-h-72 overflow-y-auto">
          {searching && (
            <p className="text-xs text-[#6B7280] text-center py-6">Searching...</p>
          )}

          {!searching && search.trim() && results.length === 0 && (
            <p className="text-xs text-[#6B7280] text-center py-6">No people found</p>
          )}

          {!searching && results.length > 0 && (
            <div className="p-2">
              {results.map((profile, idx) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => addPerson(profile)}
                  onMouseEnter={() => setHighlightedIdx(idx)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                    idx === highlightedIdx
                      ? "bg-[#2A2A2A] text-white"
                      : "text-[#9CA3AF] hover:bg-[#1E1E1E] hover:text-white"
                  )}
                >
                  {profile.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={profile.full_name ?? ""}
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0"
                      style={{ backgroundColor: hashColor(profile.id) }}
                    >
                      {initialsOf(profile.full_name)}
                    </div>
                  )}
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">
                      {profile.full_name ?? profile.email}
                    </span>
                    {profile.department && (
                      <span className="text-[11px] text-[#6B7280] truncate">{profile.department}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {!search.trim() && selected.length === 0 && (
            <p className="text-xs text-[#6B7280] text-center py-8">
              Search for teammates to message
            </p>
          )}
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-[#2A2A2A] flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={starting}
            className="text-[#9CA3AF] hover:text-white hover:bg-[#2A2A2A]"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleStart}
            disabled={selected.length === 0 || starting}
            className="bg-white text-[#111111] hover:bg-[#E5E7EB] font-medium"
          >
            {starting ? "Opening..." : buttonLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
