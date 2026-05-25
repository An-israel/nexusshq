import React from "react";
import { X, Loader2 } from "lucide-react";
import { format, isToday } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useMessages } from "@/lib/messaging/use-messages";
import { MessageItem } from "@/components/messages/MessageItem";
import { MessageInput } from "@/components/messages/MessageInput";
import type { Message, MsgProfile, UserPresence } from "@/lib/messaging/types";

interface ThreadPanelProps {
  parentMessage: Message;
  workspaceId: string;
  currentUserId: string;
  workspaceMembers: MsgProfile[];
  presence?: Record<string, UserPresence>;
  onClose: () => void;
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) {
    return format(date, "h:mm a");
  }
  return format(date, "MMM d, h:mm a");
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

function ParentMessageDisplay({ message }: { message: Message }) {
  const sender = message.sender;
  const displayName = sender?.full_name ?? sender?.email ?? "Unknown";
  const avatarColor = hashColor(message.sender_id);
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex gap-2 items-start">
      <div
        className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold mt-0.5"
        style={{ backgroundColor: avatarColor }}
      >
        {sender?.avatar_url ? (
          <img
            src={sender.avatar_url}
            alt={displayName}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          initials
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
          <span className="font-semibold text-sm text-white">{displayName}</span>
          {sender?.job_title && (
            <span className="text-[10px] bg-[#252525] text-[#9CA3AF] rounded px-1.5 py-0.5 leading-none">
              {sender.job_title}
            </span>
          )}
          <span className="text-[11px] text-[#6B7280]">{formatTimestamp(message.created_at)}</span>
        </div>
        {message.is_deleted ? (
          <p className="text-sm text-[#6B7280] italic">This message was deleted</p>
        ) : (
          <p className="text-sm text-[#E5E7EB] leading-relaxed break-words whitespace-pre-wrap">
            {message.body}
          </p>
        )}
      </div>
    </div>
  );
}

export function ThreadPanel({
  parentMessage,
  workspaceId,
  currentUserId,
  workspaceMembers,
  presence,
  onClose,
}: ThreadPanelProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [prevMessageCount, setPrevMessageCount] = React.useState(0);

  const {
    messages: replies,
    loading,
    sendVoiceNote: sendThreadVoiceNote,
    editMessage,
    deleteMessage,
    pinMessage,
  } = useMessages({
    workspaceId,
    parentMessageId: parentMessage.id,
  });

  React.useEffect(() => {
    if (replies.length > prevMessageCount) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
    setPrevMessageCount(replies.length);
  }, [replies.length]);

  async function sendReply(body: string, files?: File[]) {
    if (!body.trim() && (!files || files.length === 0)) return;

    try {
      const insertPayload: Record<string, unknown> = {
        workspace_id: workspaceId,
        channel_id: parentMessage.channel_id,
        conversation_id: parentMessage.conversation_id,
        sender_id: currentUserId,
        body,
        parent_message_id: parentMessage.id,
        has_attachment: (files?.length ?? 0) > 0,
      };

      const { data: msgData, error: msgErr } = await supabase
        .from("messages")
        .insert(insertPayload as never)
        .select()
        .single();

      if (msgErr) throw msgErr;

      if (files && files.length > 0 && msgData) {
        const insertedId = (msgData as { id: string }).id;
        const containerId = parentMessage.channel_id ?? parentMessage.conversation_id ?? "misc";

        const attachmentInserts = await Promise.all(
          files.map(async (file) => {
            const ext = file.name.split(".").pop() ?? "";
            const safeName = `${crypto.randomUUID()}.${ext}`;
            const storagePath = `${workspaceId}/${containerId}/${safeName}`;
            const { error: uploadErr } = await supabase.storage
              .from("message-attachments")
              .upload(storagePath, file);
            if (uploadErr) {
              console.error("Thread reply upload error:", uploadErr);
              return null;
            }
            const { data: urlData } = supabase.storage
              .from("message-attachments")
              .getPublicUrl(storagePath);
            return {
              message_id: insertedId,
              file_name: file.name,
              file_type: file.type,
              file_size_bytes: file.size,
              storage_path: storagePath,
              thumbnail_url: urlData?.publicUrl ?? null,
            };
          }),
        );

        const valid = attachmentInserts.filter((a): a is NonNullable<typeof a> => a !== null);
        if (valid.length > 0) {
          const { error: attErr } = await supabase.from("message_attachments").insert(valid);
          if (attErr) console.error("Thread attachment insert error:", attErr);
        }
      }
    } catch (err) {
      console.error("sendReply error:", err);
      toast.error("Failed to send reply");
      throw err;
    }
  }

  function isContinuation(index: number): boolean {
    if (index === 0) return false;
    const prev = replies[index - 1];
    const curr = replies[index];
    if (prev.sender_id !== curr.sender_id) return false;
    const prevTime = new Date(prev.created_at).getTime();
    const currTime = new Date(curr.created_at).getTime();
    return currTime - prevTime < 5 * 60 * 1000;
  }

  return (
    <aside
      className={cn(
        "flex flex-col h-full w-80 xl:w-96 bg-[#111111]",
        "border-l border-[#2A2A2A] shrink-0",
      )}
      aria-label="Thread panel"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2A2A2A] shrink-0">
        <h2 className="font-semibold text-white text-sm">Thread</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-white transition-colors"
          aria-label="Close thread"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-[#2A2A2A] shrink-0">
        <ParentMessageDisplay message={parentMessage} />
      </div>

      <div className="px-4 py-2 border-b border-[#2A2A2A] shrink-0">
        <p className="text-xs text-[#9CA3AF]">
          {replies.length === 0
            ? "No replies yet"
            : `${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-[#6B7280] animate-spin" aria-label="Loading replies" />
          </div>
        ) : replies.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-[#6B7280]">Be the first to reply in this thread</p>
          </div>
        ) : (
          replies.map((reply, i) => (
            <MessageItem
              key={reply.id}
              message={reply}
              currentUserId={currentUserId}
              presence={presence}
              isContinuation={isContinuation(i)}
              onReply={() => {}}
              onEdit={editMessage}
              onDelete={deleteMessage}
              onPin={pinMessage}
              onReact={(messageId, emoji, hasMyReaction) => {
                console.log("react", { messageId, emoji, hasMyReaction });
              }}
            />
          ))
        )}
      </div>

      <div className="border-t border-[#2A2A2A] pt-2 shrink-0">
        <MessageInput
          placeholder="Reply in thread..."
          workspaceId={workspaceId}
          channelId={parentMessage.channel_id}
          conversationId={parentMessage.conversation_id}
          currentUserId={currentUserId}
          workspaceMembers={workspaceMembers}
          onSend={sendReply}
          onSendVoiceNote={sendThreadVoiceNote}
        />
      </div>
    </aside>
  );
}
