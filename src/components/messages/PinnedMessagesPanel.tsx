import * as React from "react";
import { X, Pin } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PinnedMessagesPanelProps {
  open: boolean;
  onClose: () => void;
  channelId: string;
  workspaceId: string;
  currentUserId: string;
  onJumpToMessage?: (messageId: string) => void;
}

interface PinnedMessage {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
  pinned_by: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
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

export function PinnedMessagesPanel({
  open,
  onClose,
  channelId,
  currentUserId,
  onJumpToMessage,
}: PinnedMessagesPanelProps) {
  const [messages, setMessages] = React.useState<PinnedMessage[]>([]);
  const [profiles, setProfiles] = React.useState<Record<string, Profile>>({});
  const [loading, setLoading] = React.useState(false);

  const fetchPinnedMessages = React.useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const { data: msgs, error } = await supabase
        .from("messages")
        .select("id, body, created_at, sender_id, pinned_by")
        .eq("channel_id", channelId)
        .eq("pinned", true)
        .eq("is_deleted", false)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const pinnedMsgs = (msgs ?? []) as PinnedMessage[];
      setMessages(pinnedMsgs);

      if (pinnedMsgs.length > 0) {
        const senderIds = [...new Set(pinnedMsgs.map((m) => m.sender_id))];
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", senderIds);

        if (profileData) {
          const profileMap: Record<string, Profile> = {};
          (profileData as Profile[]).forEach((p) => {
            profileMap[p.id] = p;
          });
          setProfiles(profileMap);
        }
      }
    } catch (err) {
      console.error("Failed to load pinned messages", err);
    } finally {
      setLoading(false);
    }
  }, [open, channelId]);

  React.useEffect(() => {
    fetchPinnedMessages();
  }, [fetchPinnedMessages]);

  async function handleUnpin(messageId: string) {
    const { error } = await supabase
      .from("messages")
      .update({ pinned: false, pinned_by: null })
      .eq("id", messageId);

    if (error) {
      toast.error("Failed to unpin message");
    } else {
      toast.success("Message unpinned");
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
  }

  return (
    <div
      className={cn(
        "fixed right-0 top-0 h-full w-80 bg-[#111111] border-l border-[#2A2A2A] z-30 flex flex-col transition-transform duration-200",
        open ? "translate-x-0" : "translate-x-full",
      )}
    >
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[#2A2A2A] px-4 py-3">
        <div className="flex items-center gap-2">
          <Pin className="h-4 w-4 text-[#9CA3AF]" />
          <span className="font-semibold text-white">Pinned Messages</span>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-[#6B7280] hover:bg-[#1A1A1A] hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Pin className="mx-auto mb-3 h-8 w-8 text-[#4B5563]" />
            <p className="text-sm text-[#6B7280]">
              No pinned messages in this channel. Pin important messages by hovering over them.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#2A2A2A]">
            {messages.map((msg) => {
              const profile = profiles[msg.sender_id];
              const displayName = profile?.full_name ?? "Unknown";
              const avatarColor = hashColor(msg.sender_id);
              const initial = displayName.charAt(0).toUpperCase();

              return (
                <div key={msg.id} className="px-4 py-3 hover:bg-[#1A1A1A] transition-colors">
                  {/* Sender row */}
                  <div className="mb-1.5 flex items-center gap-2">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={displayName}
                        className="h-6 w-6 rounded-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                        style={{ backgroundColor: avatarColor }}
                      >
                        {initial}
                      </div>
                    )}
                    <span className="text-sm font-medium text-white">{displayName}</span>
                    <span className="ml-auto text-[11px] text-[#6B7280]">
                      {format(new Date(msg.created_at), "MMM d")}
                    </span>
                  </div>

                  {/* Body */}
                  <p className="mb-2 text-sm text-[#D1D5DB] line-clamp-3">{msg.body}</p>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] text-[#9CA3AF] hover:text-white hover:bg-[#2A2A2A]"
                      onClick={() => void handleUnpin(msg.id)}
                    >
                      Unpin
                    </Button>
                    {onJumpToMessage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] text-[#9CA3AF] hover:text-white hover:bg-[#2A2A2A]"
                        onClick={() => onJumpToMessage(msg.id)}
                      >
                        Jump to message
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
