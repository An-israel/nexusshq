import * as React from "react";
import { X, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ChannelMembersPanelProps {
  open: boolean;
  onClose: () => void;
  channel: {
    id: string;
    name: string;
    workspace_id: string;
    type: "public" | "private" | "announcement";
  };
  currentUserId: string;
}

interface MemberRow {
  user_id: string;
  role: string;
  joined_at: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
}

interface WorkspaceMemberCandidate {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  job_title: string | null;
}

function hashColor(id: string): string {
  const colors = [
    "#5865F2",
    "#EB459E",
    "#ED4245",
    "#FEE75C",
    "#57F287",
    "#00B0F4",
    "#E67E22",
    "#9B59B6",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return colors[hash % colors.length];
}

function Avatar({ userId, name, avatarUrl }: { userId: string; name: string; avatarUrl: string | null }) {
  const avatarColor = hashColor(userId);
  const initial = name.charAt(0).toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="h-8 w-8 rounded-full object-cover shrink-0"
      />
    );
  }

  return (
    <div
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      style={{ backgroundColor: avatarColor }}
    >
      {initial}
    </div>
  );
}

export function ChannelMembersPanel({
  open,
  onClose,
  channel,
  currentUserId,
}: ChannelMembersPanelProps) {
  const [members, setMembers] = React.useState<MemberRow[]>([]);
  const [profiles, setProfiles] = React.useState<Record<string, Profile>>({});
  const [loading, setLoading] = React.useState(false);

  // Add member search
  const [searchQuery, setSearchQuery] = React.useState("");
  const [candidates, setCandidates] = React.useState<WorkspaceMemberCandidate[]>([]);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [adding, setAdding] = React.useState<string | null>(null);

  const currentUserRole = members.find((m) => m.user_id === currentUserId)?.role ?? "member";
  const isAdmin = currentUserRole === "admin";
  const canAddMembers = isAdmin || channel.type === "public";

  const fetchMembers = React.useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const { data: memberRows, error } = await supabase
        .from("channel_members")
        .select("user_id, role, joined_at")
        .eq("channel_id", channel.id);

      if (error) throw error;

      const rows = (memberRows ?? []) as MemberRow[];
      setMembers(rows);

      if (rows.length > 0) {
        const userIds = rows.map((m) => m.user_id);
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, job_title")
          .in("id", userIds);

        if (profileData) {
          const profileMap: Record<string, Profile> = {};
          (profileData as Profile[]).forEach((p) => {
            profileMap[p.id] = p;
          });
          setProfiles(profileMap);
        }
      }
    } catch (err) {
      console.error("Failed to load channel members", err);
    } finally {
      setLoading(false);
    }
  }, [open, channel.id]);

  React.useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Search workspace members not already in the channel
  React.useEffect(() => {
    if (!searchQuery.trim()) {
      setCandidates([]);
      return;
    }

    const timeout = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const existingIds = new Set(members.map((m) => m.user_id));

        const { data: wsMembers } = await supabase
          .from("workspace_members")
          .select("user_id")
          .eq("workspace_id", channel.workspace_id)
          .eq("is_active", true);

        const candidateIds = (wsMembers ?? [])
          .map((m) => m.user_id)
          .filter((id) => !existingIds.has(id));

        if (candidateIds.length === 0) {
          setCandidates([]);
          return;
        }

        const q = searchQuery.toLowerCase();
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, job_title, email")
          .in("id", candidateIds)
          .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
          .limit(10);

        setCandidates(
          ((profs ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null; job_title: string | null; email: string | null }>)
            .filter((p) =>
              (p.full_name ?? "").toLowerCase().includes(q) ||
              (p.email ?? "").toLowerCase().includes(q)
            )
            .map((p) => ({
              user_id: p.id,
              full_name: p.full_name,
              avatar_url: p.avatar_url,
              job_title: p.job_title,
            }))
        );
      } catch (err) {
        console.error("Failed to search workspace members", err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchQuery, members, channel.workspace_id]);

  async function handleRemoveMember(userId: string) {
    const { error } = await supabase
      .from("channel_members")
      .delete()
      .eq("channel_id", channel.id)
      .eq("user_id", userId);

    if (error) {
      toast.error("Failed to remove member");
    } else {
      toast.success("Member removed");
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    }
  }

  async function handleAddMember(candidate: WorkspaceMemberCandidate) {
    setAdding(candidate.user_id);
    try {
      const { error } = await supabase.from("channel_members").insert({
        channel_id: channel.id,
        user_id: candidate.user_id,
        workspace_id: channel.workspace_id,
        role: "member",
      });

      if (error) throw error;

      toast.success(`Added ${candidate.full_name ?? "member"} to #${channel.name}`);
      setSearchQuery("");
      setCandidates([]);
      // Optimistically add to member list and profiles
      setMembers((prev) => [
        ...prev,
        { user_id: candidate.user_id, role: "member", joined_at: new Date().toISOString() },
      ]);
      setProfiles((prev) => ({
        ...prev,
        [candidate.user_id]: {
          id: candidate.user_id,
          full_name: candidate.full_name,
          avatar_url: candidate.avatar_url,
          job_title: candidate.job_title,
        },
      }));
    } catch (err) {
      toast.error("Failed to add member");
      console.error(err);
    } finally {
      setAdding(null);
    }
  }

  return (
    <div
      className={cn(
        "fixed right-0 top-0 h-full w-80 bg-[#111111] border-l border-[#2A2A2A] z-30 flex flex-col transition-transform duration-200",
        open ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#2A2A2A] px-4 py-3">
        <div className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-white">
            #{channel.name}
            <span className="ml-1.5 text-sm font-normal text-[#9CA3AF]">
              · {members.length} member{members.length !== 1 ? "s" : ""}
            </span>
          </span>
        </div>
        <button
          onClick={onClose}
          className="ml-2 shrink-0 rounded-md p-1 text-[#6B7280] hover:bg-[#1A1A1A] hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        {/* Member list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="py-2">
            {members.map((member) => {
              const profile = profiles[member.user_id];
              const displayName = profile?.full_name ?? "Unknown";
              const isSelf = member.user_id === currentUserId;

              return (
                <div
                  key={member.user_id}
                  className="flex items-center gap-3 px-4 py-2 hover:bg-[#1A1A1A] transition-colors group"
                >
                  <Avatar
                    userId={member.user_id}
                    name={displayName}
                    avatarUrl={profile?.avatar_url ?? null}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-white">{displayName}</span>
                      {member.role === "admin" && (
                        <Badge
                          variant="outline"
                          className="h-4 shrink-0 border-[#4B5563] px-1 py-0 text-[10px] text-[#9CA3AF]"
                        >
                          Admin
                        </Badge>
                      )}
                    </div>
                    {profile?.job_title && (
                      <p className="truncate text-[11px] text-[#6B7280]">{profile.job_title}</p>
                    )}
                  </div>
                  {isAdmin && !isSelf && (
                    <button
                      className="hidden group-hover:flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#6B7280] hover:bg-[#2A2A2A] hover:text-red-400 transition-colors"
                      title="Remove member"
                      onClick={() => void handleRemoveMember(member.user_id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add members section */}
        {canAddMembers && (
          <div className="border-t border-[#2A2A2A] px-4 py-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-[#9CA3AF] uppercase tracking-wide">
              <UserPlus className="h-3.5 w-3.5" />
              Add Members
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7280]" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search workspace members…"
                className="h-8 bg-[#1A1A1A] border-[#2A2A2A] pl-8 text-sm text-white placeholder:text-[#6B7280] focus-visible:ring-0 focus-visible:border-[#4B5563]"
              />
            </div>

            {searchLoading && (
              <div className="mt-2 flex items-center justify-center py-3">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}

            {candidates.length > 0 && (
              <div className="mt-2 space-y-1">
                {candidates.map((candidate) => {
                  const displayName = candidate.full_name ?? "Unknown";
                  return (
                    <button
                      key={candidate.user_id}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[#1A1A1A] transition-colors disabled:opacity-50"
                      onClick={() => void handleAddMember(candidate)}
                      disabled={adding === candidate.user_id}
                    >
                      <Avatar
                        userId={candidate.user_id}
                        name={displayName}
                        avatarUrl={candidate.avatar_url}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white">{displayName}</p>
                        {candidate.job_title && (
                          <p className="truncate text-[11px] text-[#6B7280]">{candidate.job_title}</p>
                        )}
                      </div>
                      {adding === candidate.user_id ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      ) : (
                        <UserPlus className="h-3.5 w-3.5 shrink-0 text-[#6B7280]" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {!searchLoading && searchQuery.trim() && candidates.length === 0 && (
              <p className="mt-2 text-center text-xs text-[#6B7280]">No members found</p>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
