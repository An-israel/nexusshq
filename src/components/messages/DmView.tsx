import * as React from "react";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { ChevronDown, ArrowDown, UserPlus, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useMessagingCtx } from "@/routes/_app.$workspaceSlug.messages";
import { useMessages } from "@/lib/messaging/use-messages";
import { useReactions } from "@/lib/messaging/use-reactions";
import { MessageItem } from "@/components/messages/MessageItem";
import { MessageInput } from "@/components/messages/MessageInput";
import { ThreadPanel } from "@/components/messages/ThreadPanel";
import { initialsOf } from "@/lib/nexus";
import type { DmConversationWithMeta, Message, MsgProfile, UserPresence } from "@/lib/messaging/types";

interface DmViewProps {
  conversation: DmConversationWithMeta;
  workspaceId: string;
  workspaceSlug: string;
  currentUserId: string;
  workspaceMembers: MsgProfile[];
  presence: Record<string, UserPresence>;
}

function dateDividerLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
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

function Avatar({ profile, size = 8 }: { profile: MsgProfile | undefined; size?: number }) {
  const name = profile?.full_name ?? profile?.email ?? "?";
  const sizeClass = `h-${size} w-${size}`;
  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={name}
        className={cn("rounded-full object-cover shrink-0", sizeClass)}
      />
    );
  }
  return (
    <div
      className={cn("rounded-full flex items-center justify-center shrink-0 text-white text-xs font-semibold", sizeClass)}
      style={{ backgroundColor: profile ? hashColor(profile.id) : "#374151" }}
    >
      {initialsOf(name)}
    </div>
  );
}

function PresenceDot({ status }: { status: UserPresence["status"] | undefined }) {
  const color =
    status === "active" ? "bg-success" :
    status === "away" ? "bg-warning" :
    status === "dnd" ? "bg-destructive" :
    "bg-muted-foreground";
  return (
    <span className={cn("inline-block h-2.5 w-2.5 rounded-full ring-2 ring-background", color)} />
  );
}

function getDmTitle(
  conversation: DmConversationWithMeta,
  currentUserId: string
): string {
  if (conversation.type === "direct") {
    const other = conversation.members.find((m) => m.user_id !== currentUserId);
    return other?.profile?.full_name ?? other?.profile?.email ?? "Unknown";
  }
  if (conversation.name) return conversation.name;
  const names = conversation.members
    .filter((m) => m.user_id !== currentUserId)
    .slice(0, 3)
    .map((m) => m.profile?.full_name ?? m.profile?.email ?? "Unknown");
  return names.join(", ");
}

export function DmView({
  conversation,
  workspaceId,
  currentUserId,
  workspaceMembers,
  presence,
}: DmViewProps) {
  const { onMobileBack } = useMessagingCtx();
  const [activeThread, setActiveThread] = React.useState<Message | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = React.useState(false);
  const [newMessagesBanner, setNewMessagesBanner] = React.useState(0);
  const [unreadFromIdx, setUnreadFromIdx] = React.useState<number | null>(null);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const initialScrollDone = React.useRef(false);
  const prevMessageCount = React.useRef(0);
  const unreadFromIdxSet = React.useRef(false);

  const { messages, loading, hasMore, loadMore, sendMessage, editMessage, deleteMessage, pinMessage } = useMessages({
    workspaceId,
    conversationId: conversation.id,
  });

  const { toggleReaction } = useReactions(currentUserId);

  const markRead = React.useCallback(async () => {
    await supabase
      .from("dm_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversation.id)
      .eq("user_id", currentUserId);
  }, [conversation.id, currentUserId]);

  React.useEffect(() => {
    markRead();
  }, [markRead]);

  React.useEffect(() => {
    if (!loading && messages.length > 0 && !initialScrollDone.current) {
      initialScrollDone.current = true;
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "instant" });
      }, 0);

      if (!unreadFromIdxSet.current && conversation.unread_count > 0) {
        unreadFromIdxSet.current = true;
        const idx = Math.max(0, messages.length - conversation.unread_count);
        setUnreadFromIdx(idx);
      }

      prevMessageCount.current = messages.length;
    }
  }, [loading, messages.length, conversation.unread_count]);

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

  const isDirect = conversation.type === "direct";
  const otherMember = isDirect
    ? conversation.members.find((m) => m.user_id !== currentUserId)
    : null;
  const otherProfile = otherMember?.profile;
  const otherPresence = otherMember ? presence[otherMember.user_id] : undefined;
  const title = getDmTitle(conversation, currentUserId);

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

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-[#2A2A2A] bg-[#0F0F0F] px-3 py-3">
          {/* Mobile back button */}
          <button
            onClick={onMobileBack}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#9CA3AF] hover:text-white md:hidden"
            aria-label="Back to messages"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          {isDirect ? (
            <div className="relative shrink-0">
              <Avatar profile={otherProfile} size={10} />
              <span className="absolute -bottom-0.5 -right-0.5">
                <PresenceDot status={otherPresence?.status} />
              </span>
            </div>
          ) : (
            <div className="relative flex shrink-0">
              {conversation.members.slice(0, 3).map((m, i) => (
                <div
                  key={m.id}
                  className="relative"
                  style={{ marginLeft: i > 0 ? "-8px" : "0", zIndex: 3 - i }}
                >
                  <Avatar profile={m.profile} size={8} />
                </div>
              ))}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-white leading-tight">{title}</p>
            {isDirect && otherPresence?.status_text && (
              <p className="truncate text-xs text-[#6B7280]">
                {otherPresence.status_emoji && <span className="mr-1">{otherPresence.status_emoji}</span>}
                {otherPresence.status_text}
              </p>
            )}
            {!isDirect && (
              <p className="text-xs text-[#6B7280]">
                {conversation.members.length} member{conversation.members.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          <button
            className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-[#6B7280] hover:bg-[#1A1A1A] hover:text-white transition-colors"
            title="Add to conversation"
          >
            <UserPlus className="h-3.5 w-3.5" />
          </button>
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
                  {isDirect ? (
                    <div className="relative mb-4">
                      <Avatar profile={otherProfile} size={16} />
                    </div>
                  ) : (
                    <div className="relative mb-4 flex">
                      {conversation.members.slice(0, 3).map((m, i) => (
                        <div
                          key={m.id}
                          className="relative"
                          style={{ marginLeft: i > 0 ? "-8px" : "0", zIndex: 3 - i }}
                        >
                          <Avatar profile={m.profile} size={12} />
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="font-semibold text-white">{title}</p>
                  <p className="mt-1 text-sm text-[#6B7280]">
                    {isDirect
                      ? `This is the beginning of your DM with ${title}.`
                      : `This is the beginning of your group conversation.`}
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

          {newMessagesBanner > 0 && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-1.5 text-xs font-medium text-white shadow-lg hover:bg-blue-700 transition-colors"
            >
              <ArrowDown className="h-3.5 w-3.5" />
              {newMessagesBanner} new message{newMessagesBanner !== 1 ? "s" : ""}
            </button>
          )}

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
          <MessageInput
            onSend={sendMessage}
            placeholder={isDirect ? `Message ${title}` : `Message ${title}`}
            workspaceId={workspaceId}
            conversationId={conversation.id}
            currentUserId={currentUserId}
            workspaceMembers={workspaceMembers}
          />
        </div>
      </div>

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
    </div>
  );
}
