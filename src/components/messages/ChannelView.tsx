import * as React from "react";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { Hash, Lock, Megaphone, Pin, Search, Settings, Users, ChevronDown, ArrowDown, ArrowLeft, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useNavigate } from "@tanstack/react-router";
import { useMessagingCtx } from "@/routes/_app.$workspaceSlug.messages";
import { useWorkspace } from "@/lib/workspace-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMessages } from "@/lib/messaging/use-messages";
import { useReactions } from "@/lib/messaging/use-reactions";
import { MessageItem } from "@/components/messages/MessageItem";
import { MessageInput } from "@/components/messages/MessageInput";
import { ThreadPanel } from "@/components/messages/ThreadPanel";
import { PinnedMessagesPanel } from "@/components/messages/PinnedMessagesPanel";
import { ChannelMembersPanel } from "@/components/messages/ChannelMembersPanel";
import type { ChannelWithMeta, Message, MsgProfile, UserPresence } from "@/lib/messaging/types";

interface ChannelViewProps {
  channel: ChannelWithMeta;
  workspaceId: string;
  currentUserId: string;
  workspaceMembers: MsgProfile[];
  presence: Record<string, UserPresence>;
}

function dateDividerLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

function channelIcon(type: ChannelWithMeta["type"]) {
  if (type === "private") return <Lock className="h-4 w-4 shrink-0" />;
  if (type === "announcement") return <Megaphone className="h-4 w-4 shrink-0" />;
  return <Hash className="h-4 w-4 shrink-0" />;
}

export function ChannelView({
  channel,
  workspaceId,
  currentUserId,
  workspaceMembers,
  presence,
}: ChannelViewProps) {
  const { onMobileBack } = useMessagingCtx();
  const [activeThread, setActiveThread] = React.useState<Message | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = React.useState(false);
  const [newMessagesBanner, setNewMessagesBanner] = React.useState(0);
  const [unreadFromIdx, setUnreadFromIdx] = React.useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [pinnedOpen, setPinnedOpen] = React.useState(false);
  const [membersOpen, setMembersOpen] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const initialScrollDone = React.useRef(false);
  const prevMessageCount = React.useRef(0);
  const unreadFromIdxSet = React.useRef(false);

  const { messages, loading, hasMore, loadMore, sendMessage, editMessage, deleteMessage, pinMessage } = useMessages({
    workspaceId,
    channelId: channel.id,
  });

  const { toggleReaction } = useReactions(currentUserId);

  const markRead = React.useCallback(async () => {
    await supabase
      .from("channel_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("channel_id", channel.id)
      .eq("user_id", currentUserId);
  }, [channel.id, currentUserId]);

  React.useEffect(() => {
    markRead();
  }, [markRead]);

  React.useEffect(() => {
    if (!loading && messages.length > 0 && !initialScrollDone.current) {
      initialScrollDone.current = true;
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "instant" });
      }, 0);

      if (!unreadFromIdxSet.current && channel.unread_count > 0) {
        unreadFromIdxSet.current = true;
        const idx = Math.max(0, messages.length - channel.unread_count);
        setUnreadFromIdx(idx);
      }

      prevMessageCount.current = messages.length;
    }
  }, [loading, messages.length, channel.unread_count]);

  React.useEffect(() => {
    if (!initialScrollDone.current) return;
    if (messages.length <= prevMessageCount.current) {
      prevMessageCount.current = messages.length;
      return;
    }

    const newCount = messages.length - prevMessageCount.current;
    prevMessageCount.current = messages.length;

    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;

    if (nearBottom) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      setNewMessagesBanner((prev) => prev + newCount);
    }
  }, [messages.length]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollToBottom(distFromBottom > 200);
    if (distFromBottom < 50) {
      setNewMessagesBanner(0);
      markRead();
    }
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setNewMessagesBanner(0);
    setShowScrollToBottom(false);
    markRead();
  }

  const groupedMessages = React.useMemo(() => {
    return messages.map((msg, idx) => {
      const prev = messages[idx - 1];
      const showDateDivider = !prev || !isSameDay(new Date(msg.created_at), new Date(prev.created_at));
      const isContinuation =
        !showDateDivider &&
        !!prev &&
        prev.sender_id === msg.sender_id &&
        new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000;
      return { msg, showDateDivider, isContinuation, idx };
    });
  }, [messages]);

  async function handleLeaveChannel() {
    const { error } = await supabase
      .from("channel_members")
      .delete()
      .eq("channel_id", channel.id)
      .eq("user_id", currentUserId);
    if (error) {
      toast.error("Failed to leave channel");
    } else {
      toast.success(`Left #${channel.name}`);
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex h-13 shrink-0 items-center border-b border-[#2A2A2A] bg-[#0F0F0F] px-3">
          {/* Mobile back button */}
          <button
            onClick={onMobileBack}
            className="mr-1 flex h-11 w-11 items-center justify-center rounded-lg text-[#9CA3AF] hover:text-white md:hidden"
            aria-label="Back to channels"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {/* Channel icon + name */}
          <div className="flex flex-1 min-w-0 items-center gap-2">
            <span className="text-[#9CA3AF]">{channelIcon(channel.type)}</span>
            <span className="truncate font-semibold text-white">{channel.name}</span>
            {channel.description && (
              <>
                <span className="text-[#4B5563] hidden sm:inline">·</span>
                <span className="truncate text-sm text-[#6B7280] hidden sm:inline">{channel.description}</span>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => setMembersOpen(true)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-[#6B7280] hover:bg-[#1A1A1A] hover:text-white transition-colors"
              title="Members"
            >
              <Users className="h-3.5 w-3.5" />
              <span>{channel.member_count}</span>
            </button>
            <button
              onClick={() => setPinnedOpen(true)}
              className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#1A1A1A] hover:text-white transition-colors"
              title="Pinned messages"
            >
              <Pin className="h-4 w-4" />
            </button>
            <DropdownMenu open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DropdownMenuTrigger asChild>
                <button className="rounded-md p-1.5 text-[#6B7280] hover:bg-[#1A1A1A] hover:text-white transition-colors">
                  <Settings className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-[#1A1A1A] border-[#2A2A2A]">
                <DropdownMenuItem
                  className="text-[#9CA3AF] hover:text-white focus:text-white focus:bg-[#2A2A2A] cursor-pointer"
                  onClick={() => { setSettingsOpen(false); setMembersOpen(true); }}
                >
                  View members
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[#9CA3AF] hover:text-white focus:text-white focus:bg-[#2A2A2A] cursor-pointer"
                  onClick={() => { setSettingsOpen(false); setPinnedOpen(true); }}
                >
                  Pinned messages
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-400 hover:text-red-300 focus:text-red-300 focus:bg-[#2A2A2A] cursor-pointer"
                  onClick={() => void handleLeaveChannel()}
                >
                  Leave channel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Message list */}
        <div
          ref={scrollRef}
          className="relative flex-1 overflow-y-auto"
          onScroll={handleScroll}
        >
          {loading && (
            <div className="flex h-full items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {!loading && (
            <div className="pb-4 pt-2">
              {hasMore && (
                <div className="flex justify-center py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMore}
                    className="text-xs text-[#6B7280] hover:text-white"
                  >
                    Load earlier messages
                  </Button>
                </div>
              )}

              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#1A1A1A]">
                    {channelIcon(channel.type)}
                  </div>
                  <p className="font-semibold text-white">#{channel.name}</p>
                  <p className="mt-1 text-sm text-[#6B7280]">
                    This is the beginning of #{channel.name}.
                  </p>
                </div>
              )}

              {groupedMessages.map(({ msg, showDateDivider, isContinuation, idx }) => (
                <React.Fragment key={msg.id}>
                  {showDateDivider && (
                    <div className="my-4 flex items-center gap-3 px-5">
                      <div className="flex-1 border-t border-[#2A2A2A]" />
                      <span className="text-[11px] font-medium text-[#6B7280]">
                        {dateDividerLabel(new Date(msg.created_at))}
                      </span>
                      <div className="flex-1 border-t border-[#2A2A2A]" />
                    </div>
                  )}

                  {unreadFromIdx === idx && (
                    <div className="my-2 flex items-center gap-3 px-5">
                      <div className="flex-1 border-t border-red-500/50" />
                      <span className="text-[11px] font-medium text-red-400">New messages</span>
                      <div className="flex-1 border-t border-red-500/50" />
                    </div>
                  )}

                  <MessageItem
                    message={msg}
                    currentUserId={currentUserId}
                    isContinuation={isContinuation}
                    onEdit={editMessage}
                    onDelete={deleteMessage}
                    onPin={pinMessage}
                    onReact={toggleReaction}
                    onReply={setActiveThread}
                    presence={presence}
                  />
                </React.Fragment>
              ))}

              <div ref={bottomRef} />
            </div>
          )}

          {/* New messages banner */}
          {newMessagesBanner > 0 && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              {newMessagesBanner} new message{newMessagesBanner !== 1 ? "s" : ""}
            </button>
          )}

          {/* Scroll to bottom FAB */}
          {showScrollToBottom && newMessagesBanner === 0 && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-20 right-6 flex h-8 w-8 items-center justify-center rounded-full bg-[#1A1A1A] border border-[#2A2A2A] text-[#9CA3AF] shadow-lg hover:bg-[#2A2A2A] hover:text-white transition-colors"
              title="Scroll to bottom"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Message input */}
        <div className="shrink-0 border-t border-[#2A2A2A] bg-[#0F0F0F]">
          {channel.type === "announcement" && (
            <div className="border-b border-[#2A2A2A] bg-[#1A1A1A] px-5 py-2 text-xs text-[#9CA3AF]">
              Only admins and managers can post in this channel.
            </div>
          )}
          <MessageInput
            onSend={sendMessage}
            placeholder={`Message #${channel.name}`}
            workspaceId={workspaceId}
            channelId={channel.id}
            currentUserId={currentUserId}
            workspaceMembers={workspaceMembers}
          />
        </div>
      </div>

      {/* Thread panel */}
      {activeThread && (
        <div className="w-80 shrink-0 border-l border-[#2A2A2A]">
          <ThreadPanel
            parentMessage={activeThread}
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            workspaceMembers={workspaceMembers}
            presence={presence}
            onClose={() => setActiveThread(null)}
          />
        </div>
      )}

      {/* Slide-in panels */}
      <PinnedMessagesPanel
        open={pinnedOpen}
        onClose={() => setPinnedOpen(false)}
        channelId={channel.id}
        workspaceId={workspaceId}
        currentUserId={currentUserId}
      />
      <ChannelMembersPanel
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        channel={{ id: channel.id, name: channel.name, workspace_id: workspaceId, type: channel.type }}
        currentUserId={currentUserId}
      />
    </div>
  );
}
