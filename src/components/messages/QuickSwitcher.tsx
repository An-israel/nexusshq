import React from "react";
import { Command } from "cmdk";
import { Hash, Lock, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChannelWithMeta, DmConversationWithMeta } from "@/lib/messaging/types";

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

function dmDisplayName(
  conv: DmConversationWithMeta,
  currentUserId: string
): string {
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

function sortedItems<T extends { unread_count: number; name?: string | null }>(
  items: T[],
  getName: (i: T) => string
): T[] {
  return [...items].sort((a, b) => {
    if (b.unread_count !== a.unread_count) return b.unread_count - a.unread_count;
    return getName(a).localeCompare(getName(b));
  });
}

interface Props {
  open: boolean;
  onClose: () => void;
  channels: ChannelWithMeta[];
  conversations: DmConversationWithMeta[];
  currentUserId: string;
  workspaceSlug: string;
  onSelectChannel: (id: string) => void;
  onSelectDm: (id: string) => void;
}

export function QuickSwitcher({
  open,
  onClose,
  channels,
  conversations,
  currentUserId,
  onSelectChannel,
  onSelectDm,
}: Props) {
  const [value, setValue] = React.useState("");

  React.useEffect(() => {
    if (!open) setValue("");
  }, [open]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const joinedChannels = sortedItems(
    channels.filter((c) => c.is_member),
    (c) => c.name
  );
  const sortedConvs = sortedItems(
    conversations,
    (c) => dmDisplayName(c, currentUserId)
  );

  function ChannelIcon({ type }: { type: ChannelWithMeta["type"] }) {
    if (type === "private") return <Lock className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />;
    if (type === "announcement") return <Megaphone className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />;
    return <Hash className="w-3.5 h-3.5 text-[#6B7280] shrink-0" />;
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl shadow-2xl w-full max-w-lg mx-auto mt-20 overflow-hidden">
        <Command value={value} onValueChange={setValue} className="bg-transparent">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2A2A2A]">
            <Command.Input
              placeholder="Jump to a channel or message..."
              autoFocus
              className={cn(
                "flex-1 bg-transparent text-white text-sm outline-none",
                "placeholder:text-[#6B7280]"
              )}
            />
          </div>

          <Command.List className="max-h-96 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-[#6B7280]">
              No results found
            </Command.Empty>

            {joinedChannels.length > 0 && (
              <Command.Group
                heading="Channels"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-[#6B7280] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide"
              >
                {joinedChannels.map((ch) => (
                  <Command.Item
                    key={ch.id}
                    value={`channel-${ch.name}`}
                    onSelect={() => {
                      onSelectChannel(ch.id);
                      onClose();
                    }}
                    className={cn(
                      "flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer",
                      "text-[#9CA3AF] text-sm",
                      "data-[selected=true]:bg-[#2A2A2A] data-[selected=true]:text-white",
                      "hover:bg-[#2A2A2A] hover:text-white",
                      "transition-colors"
                    )}
                  >
                    <ChannelIcon type={ch.type} />
                    <span className="flex-1 truncate">{ch.name}</span>
                    {ch.unread_count > 0 && (
                      <span className="rounded-full bg-white text-[#111111] text-[10px] font-bold px-1.5 min-w-[18px] text-center">
                        {ch.unread_count}
                      </span>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {sortedConvs.length > 0 && (
              <Command.Group
                heading="Direct Messages"
                className={cn(
                  joinedChannels.length > 0 && "mt-2",
                  "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:text-[#6B7280] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide"
                )}
              >
                {sortedConvs.map((conv) => {
                  const name = dmDisplayName(conv, currentUserId);
                  const isDirect = conv.type === "direct";
                  const otherMember = isDirect
                    ? conv.members.find((m) => m.user_id !== currentUserId)
                    : null;
                  const avatarUrl = otherMember?.profile?.avatar_url;
                  const avatarId = otherMember?.profile?.id ?? conv.id;
                  const initials = initialsOf(name);

                  return (
                    <Command.Item
                      key={conv.id}
                      value={`dm-${name}-${conv.id}`}
                      onSelect={() => {
                        onSelectDm(conv.id);
                        onClose();
                      }}
                      className={cn(
                        "flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer",
                        "text-[#9CA3AF] text-sm",
                        "data-[selected=true]:bg-[#2A2A2A] data-[selected=true]:text-white",
                        "hover:bg-[#2A2A2A] hover:text-white",
                        "transition-colors"
                      )}
                    >
                      <div className="shrink-0">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={name}
                            className="w-6 h-6 rounded-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-semibold"
                            style={{ backgroundColor: hashColor(avatarId) }}
                          >
                            {initials}
                          </div>
                        )}
                      </div>
                      <span className="flex-1 truncate">{name}</span>
                      {conv.unread_count > 0 && (
                        <span className="rounded-full bg-white text-[#111111] text-[10px] font-bold px-1.5 min-w-[18px] text-center">
                          {conv.unread_count}
                        </span>
                      )}
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
