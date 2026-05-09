import React from "react";
import {
  Hash,
  Lock,
  Megaphone,
  Search,
  Bell,
  Home,
  MessageSquare,
  Plus,
  ChevronDown,
  Circle,
  CheckCircle2,
  Moon,
  Volume2,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type {
  ChannelWithMeta,
  DmConversationWithMeta,
  MsgProfile,
  UserPresence,
} from "@/lib/messaging/types";

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

function presenceDotColor(status: UserPresence["status"] | undefined): string {
  switch (status) {
    case "active": return "#22c55e";
    case "away": return "#eab308";
    case "dnd": return "#ef4444";
    default: return "#6b7280";
  }
}

function dmDisplayName(conv: DmConversationWithMeta, currentUserId: string): string {
  if (conv.type === "direct") {
    const other = conv.members.find((m) => m.user_id !== currentUserId);
    return other?.profile?.full_name ?? other?.profile?.email ?? "Unknown";
  }
  if (conv.name) return conv.name;
  const names = conv.members
    .filter((m) => m.user_id !== currentUserId)
    .slice(0, 3)
    .map((m) => m.profile?.full_name ?? m.profile?.email ?? "Unknown");
  return names.join(", ");
}

function UserAvatar({
  profile,
  size,
  presence,
}: {
  profile: MsgProfile | null;
  size: number;
  presence?: UserPresence;
}) {
  const id = profile?.id ?? "unknown";
  const name = profile?.full_name ?? null;
  const bg = hashColor(id);
  const initials = initialsOf(name);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={name ?? ""}
          className="object-cover rounded-full"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center text-white font-semibold"
          style={{
            width: size,
            height: size,
            backgroundColor: bg,
            fontSize: Math.max(10, size * 0.35),
          }}
        >
          {initials}
        </div>
      )}
      {presence !== undefined && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-[#111111]"
          style={{
            width: 10,
            height: 10,
            backgroundColor: presenceDotColor(presence.status),
          }}
        />
      )}
    </div>
  );
}

const STATUS_OPTIONS: {
  status: UserPresence["status"];
  label: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  { status: "active", label: "Active", icon: <CheckCircle2 className="w-4 h-4" />, color: "#22c55e" },
  { status: "away", label: "Away", icon: <Circle className="w-4 h-4" />, color: "#eab308" },
  { status: "dnd", label: "Do not disturb", icon: <Moon className="w-4 h-4" />, color: "#ef4444" },
  { status: "offline", label: "Offline", icon: <Volume2 className="w-4 h-4" />, color: "#6b7280" },
];

interface Props {
  workspaceSlug: string;
  workspaceName: string;
  workspaceId: string;
  workspacePrimaryColor: string;
  workspaceLogo: string | null;
  currentUserId: string;
  activeChannelId: string | null;
  activeConversationId: string | null;
  isActivityActive: boolean;
  channels: ChannelWithMeta[];
  conversations: DmConversationWithMeta[];
  presence: Record<string, UserPresence>;
  onSelectChannel: (id: string) => void;
  onSelectDm: (id: string) => void;
  onSelectActivity: () => void;
  onOpenCreateChannel: () => void;
  onOpenNewDm: () => void;
  onOpenSearch: () => void;
}

export function MessagesSidebar({
  workspaceSlug,
  workspaceName,
  workspaceId: _workspaceId,
  workspacePrimaryColor,
  workspaceLogo,
  currentUserId,
  activeChannelId,
  activeConversationId,
  isActivityActive,
  channels,
  conversations,
  presence,
  onSelectChannel,
  onSelectDm,
  onSelectActivity,
  onOpenCreateChannel,
  onOpenNewDm,
  onOpenSearch,
}: Props) {
  const [statusPopoverOpen, setStatusPopoverOpen] = React.useState(false);
  const [customStatusText, setCustomStatusText] = React.useState("");

  const joinedChannels = React.useMemo(
    () => channels.filter((c) => c.is_member && !c.is_archived),
    [channels]
  );

  const myPresence = presence[currentUserId];

  const myProfile = React.useMemo<MsgProfile | null>(() => {
    for (const conv of conversations) {
      const me = conv.members.find((m) => m.user_id === currentUserId);
      if (me?.profile) return me.profile;
    }
    return null;
  }, [conversations, currentUserId]);

  function ChannelIcon({ type }: { type: ChannelWithMeta["type"] }) {
    if (type === "private")
      return <Lock className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />;
    if (type === "announcement")
      return <Megaphone className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />;
    return <Hash className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />;
  }

  return (
    <div className="bg-[#111111] w-64 flex flex-col h-full overflow-hidden select-none">
      <div className="p-3 pb-2">
        <button
          type="button"
          className="flex items-center gap-2 w-full rounded-md px-2 py-1.5 hover:bg-[#1A1A1A] transition-colors"
        >
          {workspaceLogo ? (
            <img
              src={workspaceLogo}
              alt={workspaceName}
              className="w-6 h-6 rounded object-cover shrink-0"
            />
          ) : (
            <div
              className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: workspacePrimaryColor }}
            >
              {workspaceName[0]?.toUpperCase() ?? "W"}
            </div>
          )}
          <span className="text-white text-sm font-semibold truncate flex-1 text-left">
            {workspaceName}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />
        </button>
      </div>

      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex items-center gap-2 w-full bg-[#1E1E1E] rounded-md px-3 py-1.5 text-sm text-[#9CA3AF] hover:bg-[#252525] transition-colors"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Search {workspaceName}</span>
        </button>
      </div>

      <div className="px-1 py-1">
        <a
          href={`/${workspaceSlug}/dashboard`}
          className={cn(
            "flex items-center gap-2.5 h-8 px-2 rounded-md mx-1 cursor-pointer",
            "text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-white transition-colors text-sm"
          )}
        >
          <Home className="w-4 h-4 shrink-0" />
          <span>Home</span>
        </a>

        <button
          type="button"
          onClick={() => {
            const dmSection = document.getElementById("sidebar-dms");
            dmSection?.scrollIntoView({ behavior: "smooth" });
          }}
          className={cn(
            "flex items-center gap-2.5 h-8 px-2 rounded-md mx-1 w-full cursor-pointer",
            "text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-white transition-colors text-sm"
          )}
        >
          <MessageSquare className="w-4 h-4 shrink-0" />
          <span>DMs</span>
        </button>

        <button
          type="button"
          onClick={onSelectActivity}
          className={cn(
            "flex items-center gap-2.5 h-8 px-2 rounded-md mx-1 w-full cursor-pointer transition-colors text-sm",
            isActivityActive
              ? "bg-[#1E1E1E] text-white"
              : "text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-white"
          )}
        >
          <Bell className="w-4 h-4 shrink-0" />
          <span>Activity</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin mt-1">
        <div className="mb-2">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-[#9CA3AF] text-xs uppercase tracking-wide font-medium">
              Channels
            </span>
            <button
              type="button"
              onClick={onOpenCreateChannel}
              className="text-[#6B7280] hover:text-white transition-colors rounded p-0.5 hover:bg-[#1A1A1A]"
              title="Create channel"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {joinedChannels.map((ch) => {
            const isActive = ch.id === activeChannelId;
            const hasUnread = ch.unread_count > 0;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => onSelectChannel(ch.id)}
                className={cn(
                  "flex items-center gap-1.5 h-8 px-2 rounded-md mx-1 cursor-pointer w-[calc(100%-8px)] transition-colors",
                  isActive
                    ? "bg-[#1E1E1E] text-white"
                    : hasUnread
                      ? "text-white font-semibold hover:bg-[#1A1A1A]"
                      : "text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-white"
                )}
              >
                <ChannelIcon type={ch.type} />
                <span className="text-sm truncate flex-1 text-left">{ch.name}</span>
                {hasUnread && (
                  <span className="rounded-full bg-white text-[#111111] text-[10px] font-bold px-1.5 min-w-[18px] text-center shrink-0">
                    {ch.unread_count > 99 ? "99+" : ch.unread_count}
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={onOpenCreateChannel}
            className={cn(
              "flex items-center gap-1.5 h-8 px-2 rounded-md mx-1 w-[calc(100%-8px)]",
              "text-[#9CA3AF] hover:text-white hover:bg-[#1A1A1A] transition-colors text-sm cursor-pointer"
            )}
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Add a channel</span>
          </button>
        </div>

        <div id="sidebar-dms">
          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-[#9CA3AF] text-xs uppercase tracking-wide font-medium">
              Direct messages
            </span>
            <button
              type="button"
              onClick={onOpenNewDm}
              className="text-[#6B7280] hover:text-white transition-colors rounded p-0.5 hover:bg-[#1A1A1A]"
              title="New direct message"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const hasUnread = conv.unread_count > 0;
            const isDirect = conv.type === "direct";
            const otherMember = isDirect
              ? conv.members.find((m) => m.user_id !== currentUserId)
              : null;
            const otherProfile = otherMember?.profile ?? null;
            const isCurrentUserDirect =
              isDirect && conv.members.every((m) => m.user_id === currentUserId);
            const displayName = dmDisplayName(conv, currentUserId);
            const otherPresence = otherMember
              ? presence[otherMember.user_id]
              : undefined;

            const groupMembers = !isDirect
              ? conv.members.filter((m) => m.user_id !== currentUserId).slice(0, 3)
              : [];

            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => onSelectDm(conv.id)}
                className={cn(
                  "flex items-center gap-2 h-9 px-2 rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer transition-colors",
                  isActive
                    ? "bg-[#1E1E1E] text-white"
                    : hasUnread
                      ? "text-white font-semibold hover:bg-[#1A1A1A]"
                      : "text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-white"
                )}
              >
                {isDirect ? (
                  <UserAvatar
                    profile={otherProfile}
                    size={24}
                    presence={otherPresence}
                  />
                ) : (
                  <div className="relative w-6 h-6 shrink-0">
                    {groupMembers.slice(0, 2).map((m, i) => (
                      <div
                        key={m.user_id}
                        className="absolute rounded-full border border-[#111111]"
                        style={{
                          width: 16,
                          height: 16,
                          top: i === 0 ? 0 : 8,
                          left: i === 0 ? 0 : 8,
                          backgroundColor: hashColor(m.user_id),
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 8,
                          color: "white",
                          fontWeight: 600,
                          zIndex: i === 0 ? 1 : 2,
                        }}
                      >
                        {initialsOf(m.profile?.full_name ?? null)}
                      </div>
                    ))}
                  </div>
                )}

                <span className="text-sm truncate flex-1 text-left">
                  {displayName}
                  {isCurrentUserDirect && (
                    <span className="text-[#6B7280] font-normal ml-1">(You)</span>
                  )}
                </span>

                {hasUnread && (
                  <span className="rounded-full bg-white text-[#111111] text-[10px] font-bold px-1.5 min-w-[18px] text-center shrink-0">
                    {conv.unread_count > 99 ? "99+" : conv.unread_count}
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={onOpenNewDm}
            className={cn(
              "flex items-center gap-1.5 h-8 px-2 rounded-md mx-1 w-[calc(100%-8px)]",
              "text-[#9CA3AF] hover:text-white hover:bg-[#1A1A1A] transition-colors text-sm cursor-pointer"
            )}
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>New direct message</span>
          </button>
        </div>
      </div>

      <div className="mt-auto p-3 border-t border-[#1E1E1E]">
        <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2.5 w-full rounded-md px-2 py-1.5 hover:bg-[#1A1A1A] transition-colors"
            >
              <UserAvatar profile={myProfile} size={28} presence={myPresence} />
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span className="text-white text-xs font-medium truncate w-full text-left">
                  {myProfile?.full_name ?? myProfile?.email ?? "Me"}
                </span>
                <span className="text-[#6B7280] text-[10px] truncate w-full text-left">
                  {myPresence?.status_text || "Set status"}
                </span>
              </div>
            </button>
          </PopoverTrigger>

          <PopoverContent
            side="top"
            align="start"
            className="p-0 w-64 border border-[#2A2A2A] bg-[#1A1A1A] shadow-2xl"
            sideOffset={8}
          >
            <div className="p-3 flex flex-col gap-1">
              <p className="text-[10px] text-[#6B7280] uppercase tracking-wide px-1 pb-1">
                Set status
              </p>
              {STATUS_OPTIONS.map((opt) => {
                const isActive = myPresence?.status === opt.status;
                return (
                  <button
                    key={opt.status}
                    type="button"
                    className={cn(
                      "flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors w-full text-left",
                      isActive
                        ? "bg-[#2A2A2A] text-white"
                        : "text-[#9CA3AF] hover:bg-[#1E1E1E] hover:text-white"
                    )}
                  >
                    <span style={{ color: opt.color }}>{opt.icon}</span>
                    <span>{opt.label}</span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: opt.color }} />
                    )}
                  </button>
                );
              })}

              <div className="mt-2 pt-2 border-t border-[#2A2A2A]">
                <p className="text-[10px] text-[#6B7280] px-1 pb-1">Custom status</p>
                <input
                  type="text"
                  value={customStatusText}
                  onChange={(e) => setCustomStatusText(e.target.value)}
                  placeholder="What's your status?"
                  maxLength={100}
                  className={cn(
                    "w-full bg-[#111111] border border-[#2A2A2A] rounded-md px-3 py-1.5",
                    "text-sm text-white placeholder:text-[#4B5563] outline-none",
                    "focus:ring-1 focus:ring-[#3B3B3B] transition-colors"
                  )}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
