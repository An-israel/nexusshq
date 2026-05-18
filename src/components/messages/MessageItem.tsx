import React from "react";
import { format, isToday } from "date-fns";
import {
  Smile,
  Reply,
  Bookmark,
  Pencil,
  Trash2,
  MoreHorizontal,
  Pin,
  FileText,
  File,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "@/components/messages/EmojiPicker";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Message, MsgProfile, UserPresence } from "@/lib/messaging/types";

interface MessageItemProps {
  message: Message;
  currentUserId: string;
  presence?: Record<string, UserPresence>;
  isContinuation: boolean;
  isHighlighted?: boolean;
  onReply: (message: Message) => void;
  onEdit: (id: string, body: string) => void;
  onDelete: (id: string) => void;
  onReact: (messageId: string, emoji: string, hasMyReaction: boolean) => void;
  onPin: (id: string, pinned: boolean) => void;
  onAvatarClick?: (profile: MsgProfile) => void;
}

const HASH_COLORS = [
  "#5865F2",
  "#EB459E",
  "#ED4245",
  "#FEE75C",
  "#57F287",
  "#00B0F4",
  "#E67E22",
  "#9B59B6",
];

function hashColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return HASH_COLORS[hash % HASH_COLORS.length];
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) {
    return format(date, "h:mm a");
  }
  return format(date, "MMM d, h:mm a");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type BodyToken =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "code"; value: string }
  | { type: "codeblock"; value: string }
  | { type: "mention"; value: string }
  | { type: "link"; value: string; href: string };

function tokenizeBody(body: string): BodyToken[] {
  const tokens: BodyToken[] = [];

  const codeBlockRegex = /```([\s\S]*?)```/g;
  const parts = body.split(codeBlockRegex);

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      tokens.push({ type: "codeblock", value: parts[i] });
      continue;
    }

    const segment = parts[i];
    const inlineRegex =
      /(\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_|`([^`]+)`|(@\w[\w\s]*\w|\w+)|(https?:\/\/[^\s]+))/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = inlineRegex.exec(segment)) !== null) {
      if (match.index > lastIndex) {
        tokens.push({
          type: "text",
          value: segment.slice(lastIndex, match.index),
        });
      }

      const full = match[0];
      if (full.startsWith("**") && full.endsWith("**")) {
        tokens.push({ type: "bold", value: full.slice(2, -2) });
      } else if (
        (full.startsWith("*") && full.endsWith("*") && !full.startsWith("**")) ||
        (full.startsWith("_") && full.endsWith("_"))
      ) {
        tokens.push({ type: "italic", value: full.slice(1, -1) });
      } else if (full.startsWith("`") && full.endsWith("`")) {
        tokens.push({ type: "code", value: full.slice(1, -1) });
      } else if (full.startsWith("@")) {
        tokens.push({ type: "mention", value: full });
      } else if (full.startsWith("http")) {
        tokens.push({ type: "link", value: full, href: full });
      } else {
        tokens.push({ type: "text", value: full });
      }

      lastIndex = match.index + full.length;
    }

    if (lastIndex < segment.length) {
      tokens.push({ type: "text", value: segment.slice(lastIndex) });
    }
  }

  return tokens;
}

function renderBody(body: string): React.ReactNode {
  const tokens = tokenizeBody(body);
  return tokens.map((token, i) => {
    switch (token.type) {
      case "codeblock":
        return (
          <pre
            key={i}
            className="bg-[#1A1A1A] rounded-lg p-3 overflow-x-auto text-sm font-mono text-[#E5E7EB] my-1 whitespace-pre-wrap"
          >
            {token.value}
          </pre>
        );
      case "bold":
        return (
          <strong key={i} className="font-bold">
            {token.value}
          </strong>
        );
      case "italic":
        return (
          <em key={i} className="italic">
            {token.value}
          </em>
        );
      case "code":
        return (
          <code key={i} className="bg-[#2A2A2A] rounded px-1 font-mono text-sm text-[#E5E7EB]">
            {token.value}
          </code>
        );
      case "mention":
        return (
          <span key={i} className="bg-primary/20 text-primary rounded px-1 font-medium">
            {token.value}
          </span>
        );
      case "link":
        return (
          <a
            key={i}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            {token.value}
          </a>
        );
      default:
        return <React.Fragment key={i}>{token.value}</React.Fragment>;
    }
  });
}

interface ReactionGroup {
  emoji: string;
  count: number;
  users: string[];
  hasMyReaction: boolean;
}

function groupReactions(reactions: Message["reactions"], currentUserId: string): ReactionGroup[] {
  const map = new Map<string, ReactionGroup>();
  for (const r of reactions ?? []) {
    const existing = map.get(r.emoji) ?? {
      emoji: r.emoji,
      count: 0,
      users: [],
      hasMyReaction: false,
    };
    existing.count += 1;
    existing.users.push(r.profile?.full_name ?? r.user_id);
    if (r.user_id === currentUserId) existing.hasMyReaction = true;
    map.set(r.emoji, existing);
  }
  return Array.from(map.values());
}

function AttachmentRow({ attachments }: { attachments: Message["attachments"] }) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {attachments.map((att) => {
        const isImage = att.file_type.startsWith("image/");
        if (isImage) {
          const src = att.thumbnail_url ?? att.google_drive_view_url ?? undefined;
          return (
            <div
              key={att.id}
              className="rounded-lg overflow-hidden border border-[#2A2A2A] max-w-xs"
            >
              {src ? (
                <img src={src} alt={att.file_name} className="max-h-64 object-contain" />
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-[#9CA3AF]">
                  <FileText className="w-4 h-4" />
                  {att.file_name}
                </div>
              )}
            </div>
          );
        }

        const isPdf = att.file_type === "application/pdf";
        const isDoc =
          att.file_type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        const IconEl = isPdf || isDoc ? FileText : File;
        const openUrl =
          att.google_drive_view_url ?? (att.storage_path ? att.storage_path : undefined);

        return (
          <div
            key={att.id}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] text-sm"
          >
            <IconEl className="w-4 h-4 text-[#9CA3AF] shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-white truncate max-w-[180px]">{att.file_name}</span>
              <span className="text-[#6B7280] text-xs">{formatBytes(att.file_size_bytes)}</span>
            </div>
            {openUrl && (
              <a
                href={openUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary text-xs hover:underline shrink-0"
              >
                Open
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ThreadPreview({ message, onReply }: { message: Message; onReply: (m: Message) => void }) {
  if (message.thread_reply_count === 0) return null;

  const lastReply = message.thread_last_reply_at
    ? formatTimestamp(message.thread_last_reply_at)
    : null;

  return (
    <button
      type="button"
      onClick={() => onReply(message)}
      className="mt-1 flex items-center gap-2 text-xs text-primary hover:underline"
      aria-label={`View ${message.thread_reply_count} thread replies`}
    >
      <span className="font-medium">
        {message.thread_reply_count} {message.thread_reply_count === 1 ? "reply" : "replies"}
      </span>
      {lastReply && <span className="text-[#9CA3AF]">· Last reply {lastReply}</span>}
    </button>
  );
}

export function MessageItem({
  message,
  currentUserId,
  isContinuation,
  isHighlighted,
  onReply,
  onEdit,
  onDelete,
  onReact,
  onPin,
  onAvatarClick,
}: MessageItemProps) {
  const [hovered, setHovered] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(message.body);
  const [moreOpen, setMoreOpen] = React.useState(false);

  const isOwn = message.sender_id === currentUserId;
  const sender = message.sender;
  const displayName = sender?.full_name ?? sender?.email ?? "Unknown";
  const avatarColor = hashColor(message.sender_id);
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const reactionGroups = groupReactions(message.reactions, currentUserId);

  function handleEditSubmit() {
    if (editValue.trim() && editValue.trim() !== message.body) {
      onEdit(message.id, editValue.trim());
    }
    setEditing(false);
  }

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEditSubmit();
    }
    if (e.key === "Escape") {
      setEditValue(message.body);
      setEditing(false);
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "group relative flex gap-2 px-4 py-0.5 rounded-lg transition-colors",
          "hover:bg-[#1A1A1A]",
          isContinuation ? "items-start" : "items-start",
          isHighlighted && "bg-yellow-500/10 animate-pulse",
        )}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          if (!moreOpen) setHovered(false);
        }}
      >
        {!isContinuation ? (
          <button
            type="button"
            className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold mt-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            style={{ backgroundColor: avatarColor }}
            onClick={() => sender && onAvatarClick?.(sender)}
            aria-label={`View profile of ${displayName}`}
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
          </button>
        ) : (
          <div className="w-8 shrink-0 relative">
            {hovered && (
              <span className="absolute left-0 top-0 text-[10px] text-[#6B7280] whitespace-nowrap leading-4">
                {format(new Date(message.created_at), "h:mm a")}
              </span>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0">
          {!isContinuation && (
            <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
              <span className="font-semibold text-sm text-white leading-tight">{displayName}</span>
              {sender?.job_title && (
                <span className="text-[10px] bg-[#252525] text-[#9CA3AF] rounded px-1.5 py-0.5 leading-none">
                  {sender.job_title}
                </span>
              )}
              <span className="text-[11px] text-[#6B7280]">
                {formatTimestamp(message.created_at)}
              </span>
              {message.pinned && (
                <span className="text-[10px] text-yellow-500 flex items-center gap-0.5">
                  <Pin className="w-2.5 h-2.5" /> Pinned
                </span>
              )}
            </div>
          )}

          {message.is_deleted ? (
            <p className="text-sm text-[#6B7280] italic">This message was deleted</p>
          ) : editing ? (
            <div className="mt-1">
              <textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={handleEditKeyDown}
                className="w-full bg-[#2A2A2A] border border-[#3A3A3A] rounded-lg p-2 text-sm text-white outline-none resize-none focus:border-primary/50"
                rows={3}
                autoFocus
                aria-label="Edit message"
              />
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={handleEditSubmit}
                  className="text-xs bg-primary text-white px-2 py-1 rounded hover:bg-primary/90"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditValue(message.body);
                    setEditing(false);
                  }}
                  className="text-xs text-[#9CA3AF] px-2 py-1 rounded hover:bg-[#2A2A2A]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-[#E5E7EB] leading-relaxed break-words">
              {renderBody(message.body)}
              {message.is_edited && <span className="text-xs text-[#6B7280] ml-1">(edited)</span>}
            </div>
          )}

          {!message.is_deleted && <AttachmentRow attachments={message.attachments} />}

          {!message.is_deleted && reactionGroups.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 mt-1">
              {reactionGroups.map((group) => (
                <Tooltip key={group.emoji}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onReact(message.id, group.emoji, group.hasMyReaction)}
                      className={cn(
                        "flex items-center gap-1 text-xs rounded-full border px-2 py-0.5 transition-colors",
                        "bg-[#1E1E1E] border-[#2A2A2A] hover:bg-[#252525]",
                        group.hasMyReaction && "border-primary/50 bg-primary/10",
                      )}
                      aria-label={`${group.emoji} reaction, ${group.count} ${group.count === 1 ? "person" : "people"}`}
                    >
                      <span>{group.emoji}</span>
                      <span className="text-[#9CA3AF]">{group.count}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-[#1A1A1A] border-[#2A2A2A] text-white text-xs"
                  >
                    {group.users.join(", ")} reacted with {group.emoji}
                  </TooltipContent>
                </Tooltip>
              ))}
              <EmojiPicker
                onSelect={(emoji) => {
                  const existing = reactionGroups.find((g) => g.emoji === emoji);
                  onReact(message.id, emoji, existing?.hasMyReaction ?? false);
                }}
                trigger={
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs rounded-full border border-[#2A2A2A] px-2 py-0.5 bg-[#1E1E1E] hover:bg-[#252525] text-[#9CA3AF] transition-colors"
                    aria-label="Add reaction"
                  >
                    <Smile className="w-3 h-3" />
                  </button>
                }
              />
            </div>
          )}

          {!message.is_deleted && <ThreadPreview message={message} onReply={onReply} />}
        </div>

        {!message.is_deleted && hovered && (
          <div className="absolute right-4 -top-4 flex items-center gap-0.5 bg-[#1E1E1E] border border-[#2A2A2A] rounded-lg px-1 py-0.5 shadow-lg z-10">
            <EmojiPicker
              onSelect={(emoji) => {
                const existing = reactionGroups.find((g) => g.emoji === emoji);
                onReact(message.id, emoji, existing?.hasMyReaction ?? false);
              }}
              trigger={
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="p-1.5 rounded hover:bg-[#2A2A2A] text-[#9CA3AF] hover:text-white transition-colors"
                      aria-label="Add reaction"
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    className="bg-[#1A1A1A] border-[#2A2A2A] text-white text-xs"
                  >
                    Add reaction
                  </TooltipContent>
                </Tooltip>
              }
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onReply(message)}
                  className="p-1.5 rounded hover:bg-[#2A2A2A] text-[#9CA3AF] hover:text-white transition-colors"
                  aria-label="Reply in thread"
                >
                  <Reply className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-[#1A1A1A] border-[#2A2A2A] text-white text-xs"
              >
                Reply in thread
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => toast.info("Saved to bookmarks")}
                  className="p-1.5 rounded hover:bg-[#2A2A2A] text-[#9CA3AF] hover:text-white transition-colors"
                  aria-label="Save message"
                >
                  <Bookmark className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="bg-[#1A1A1A] border-[#2A2A2A] text-white text-xs"
              >
                Save message
              </TooltipContent>
            </Tooltip>

            {isOwn && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => {
                      setEditValue(message.body);
                      setEditing(true);
                    }}
                    className="p-1.5 rounded hover:bg-[#2A2A2A] text-[#9CA3AF] hover:text-white transition-colors"
                    aria-label="Edit message"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="bg-[#1A1A1A] border-[#2A2A2A] text-white text-xs"
                >
                  Edit message
                </TooltipContent>
              </Tooltip>
            )}

            {isOwn && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onDelete(message.id)}
                    className="p-1.5 rounded hover:bg-[#2A2A2A] text-red-400 hover:text-red-300 transition-colors"
                    aria-label="Delete message"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  className="bg-[#1A1A1A] border-[#2A2A2A] text-white text-xs"
                >
                  Delete message
                </TooltipContent>
              </Tooltip>
            )}

            <Popover
              open={moreOpen}
              onOpenChange={(open) => {
                setMoreOpen(open);
                if (!open) setHovered(false);
              }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="p-1.5 rounded hover:bg-[#2A2A2A] text-[#9CA3AF] hover:text-white transition-colors"
                  aria-label="More options"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="end"
                className="w-44 p-1 bg-[#1A1A1A] border-[#2A2A2A]"
              >
                <button
                  type="button"
                  onClick={() => {
                    onPin(message.id, !message.pinned);
                    setMoreOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-[#E5E7EB] hover:bg-[#2A2A2A] transition-colors"
                >
                  <Pin className="w-3.5 h-3.5" />
                  {message.pinned ? "Unpin message" : "Pin message"}
                </button>
                {!isOwn && (
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(message.id);
                      setMoreOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-red-400 hover:bg-[#2A2A2A] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete message
                  </button>
                )}
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
