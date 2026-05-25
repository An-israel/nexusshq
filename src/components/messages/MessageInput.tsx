import React from "react";
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Link,
  Code2,
  Paperclip,
  Smile,
  SendHorizonal,
  Mic,
  X,
  FileText,
  File,
} from "lucide-react";
import { VoiceNoteRecorder } from "@/components/messages/VoiceNoteRecorder";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "@/components/messages/EmojiPicker";
import type { MsgProfile } from "@/lib/messaging/types";

interface MessageInputProps {
  placeholder: string;
  workspaceId: string;
  channelId?: string | null;
  conversationId?: string | null;
  currentUserId: string;
  workspaceMembers: MsgProfile[];
  onSend: (body: string, files?: File[]) => Promise<void>;
  onSendVoiceNote?: (blob: Blob, duration: number, waveformData: number[]) => Promise<void>;
  onEditLastMessage?: () => void;
  disabled?: boolean;
}

const MAX_FILES = 5;
const MAX_FILE_BYTES = 100 * 1024 * 1024;
const CHAR_LIMIT = 4000;
const ACCEPTED_TYPES =
  "image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,video/mp4,application/zip";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: string): React.ReactNode {
  if (type.startsWith("image/")) return null;
  if (type === "application/pdf" || type.includes("wordprocessingml"))
    return <FileText className="w-3.5 h-3.5" />;
  return <File className="w-3.5 h-3.5" />;
}

interface ToolbarButtonProps {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}

function ToolbarButton({ label, onClick, active, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "p-1.5 rounded text-[#9CA3AF] hover:bg-[#252525] hover:text-white transition-colors",
        active && "bg-[#252525] text-white",
      )}
    >
      {children}
    </button>
  );
}

export function MessageInput({
  placeholder,
  workspaceMembers,
  onSend,
  onSendVoiceNote,
  onEditLastMessage,
  disabled,
}: MessageInputProps) {
  const [value, setValue] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [sending, setSending] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = React.useState(0);
  const [mentionStart, setMentionStart] = React.useState<number | null>(null);
  const [voiceRecording, setVoiceRecording] = React.useState(false);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const dropZoneRef = React.useRef<HTMLDivElement>(null);

  const filteredMembers = React.useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return workspaceMembers
      .filter((m) => m.full_name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q))
      .slice(0, 6);
  }, [mentionQuery, workspaceMembers]);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineH = 20;
    const maxH = lineH * 8 + 16;
    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
  }

  React.useEffect(() => {
    autoResize();
  }, [value]);

  function getSelection(): { start: number; end: number } {
    const el = textareaRef.current;
    if (!el) return { start: 0, end: 0 };
    return { start: el.selectionStart, end: el.selectionEnd };
  }

  function insertAround(before: string, after: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { start, end } = getSelection();
    const selected = value.slice(start, end);
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + before.length, end + before.length);
    });
  }

  function wrapLines(prefix: (i: number) => string) {
    const el = textareaRef.current;
    if (!el) return;
    const { start, end } = getSelection();
    const selected = value.slice(start, end);
    const lines = selected.split("\n");
    const wrapped = lines.map((l, i) => prefix(i) + l).join("\n");
    const next = value.slice(0, start) + wrapped + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => el.focus());
  }

  function handleBold() {
    insertAround("**", "**");
  }
  function handleItalic() {
    insertAround("_", "_");
  }
  function handleStrike() {
    insertAround("~~", "~~");
  }
  function handleCode() {
    insertAround("`", "`");
  }
  function handleBulletList() {
    wrapLines(() => "• ");
  }
  function handleOrderedList() {
    wrapLines((i) => `${i + 1}. `);
  }
  function handleLink() {
    const url = window.prompt("Enter URL:");
    if (!url) return;
    const el = textareaRef.current;
    if (!el) return;
    const { start, end } = getSelection();
    const selected = value.slice(start, end) || "link text";
    const link = `[${selected}](${url})`;
    const next = value.slice(0, start) + link + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => el.focus());
  }
  function handleCodeBlock() {
    const el = textareaRef.current;
    if (!el) return;
    const { start, end } = getSelection();
    const selected = value.slice(start, end);
    const block = "```\n" + selected + "\n```";
    const next = value.slice(0, start) + block + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + 4, start + 4 + selected.length);
    });
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newVal = e.target.value;
    if (newVal.length > CHAR_LIMIT) return;
    setValue(newVal);

    const pos = e.target.selectionStart;
    const textBefore = newVal.slice(0, pos);
    const atMatch = textBefore.match(/@([\w\s]*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionStart(pos - atMatch[0].length);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
      setMentionStart(null);
    }
  }

  function insertMention(member: MsgProfile) {
    if (mentionStart === null) return;
    const name = member.full_name ?? member.email ?? "Unknown";
    const before = value.slice(0, mentionStart);
    const after = value.slice(textareaRef.current?.selectionStart ?? 0);
    const next = before + `@${name} ` + after;
    setValue(next);
    setMentionQuery(null);
    setMentionStart(null);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filteredMembers.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const member = filteredMembers[mentionIndex];
        if (member) insertMention(member);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        setMentionStart(null);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }

    if (e.key === "ArrowUp" && value === "") {
      onEditLastMessage?.();
    }
  }

  async function handleSend() {
    const trimmed = value.trim();
    if (!trimmed && files.length === 0) return;
    setSending(true);
    try {
      await onSend(trimmed, files.length > 0 ? files : undefined);
      setValue("");
      setFiles([]);
      setMentionQuery(null);
      setMentionStart(null);
    } catch {
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  }

  function addFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming);
    const filtered = arr.filter((f) => {
      if (f.size > MAX_FILE_BYTES) {
        toast.error(`${f.name} exceeds 100 MB limit`);
        return false;
      }
      return true;
    });
    setFiles((prev) => {
      const combined = [...prev, ...filtered];
      if (combined.length > MAX_FILES) {
        toast.error(`Maximum ${MAX_FILES} files allowed`);
        return combined.slice(0, MAX_FILES);
      }
      return combined;
    });
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      addFiles(e.target.files);
      e.target.value = "";
    }
  }

  function removeFile(i: number) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setDragging(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  const charsLeft = CHAR_LIMIT - value.length;
  const showCounter = value.length > 3000;
  const canSend = (value.trim().length > 0 || files.length > 0) && !sending && !disabled;
  const showMic = !canSend && !!onSendVoiceNote;

  return (
    <div className="relative mx-4 mb-4">
      {voiceRecording && onSendVoiceNote ? (
        <VoiceNoteRecorder
          onSend={async (blob, dur, wf) => {
            await onSendVoiceNote(blob, dur, wf);
            setVoiceRecording(false);
          }}
          onCancel={() => setVoiceRecording(false)}
          disabled={disabled}
        />
      ) : (
        <>
          {mentionQuery !== null && filteredMembers.length > 0 && (
            <div className="absolute bottom-full mb-2 left-0 w-72 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl shadow-2xl overflow-hidden z-20">
              {filteredMembers.map((member, i) => (
                <button
                  key={member.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(member);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors text-left",
                    i === mentionIndex
                      ? "bg-[#2A2A2A] text-white"
                      : "text-[#E5E7EB] hover:bg-[#252525]",
                  )}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                    style={{
                      backgroundColor: `hsl(${(member.id.charCodeAt(0) * 37) % 360}, 60%, 45%)`,
                    }}
                  >
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.full_name ?? ""}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      (member.full_name ?? member.email ?? "?")[0].toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{member.full_name ?? member.email}</p>
                    {member.department && (
                      <p className="text-xs text-[#9CA3AF] truncate">{member.department}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              "relative rounded-xl border bg-[#1A1A1A] transition-colors",
              dragging ? "border-primary border-dashed" : "border-[#2A2A2A]",
            )}
          >
            {dragging && (
              <div className="absolute inset-0 rounded-xl z-10 flex items-center justify-center bg-[#1A1A1A]/80 border-2 border-dashed border-primary">
                <p className="text-primary text-sm font-medium">Drop files to upload</p>
              </div>
            )}

            <div className="flex items-center gap-0.5 px-2 pt-2 pb-1 border-b border-[#2A2A2A]">
              <ToolbarButton label="Bold" onClick={handleBold}>
                <Bold className="w-3.5 h-3.5" />
              </ToolbarButton>
              <ToolbarButton label="Italic" onClick={handleItalic}>
                <Italic className="w-3.5 h-3.5" />
              </ToolbarButton>
              <ToolbarButton label="Strikethrough" onClick={handleStrike}>
                <Strikethrough className="w-3.5 h-3.5" />
              </ToolbarButton>
              <ToolbarButton label="Inline code" onClick={handleCode}>
                <Code className="w-3.5 h-3.5" />
              </ToolbarButton>
              <div className="w-px h-4 bg-[#2A2A2A] mx-0.5" />
              <ToolbarButton label="Bullet list" onClick={handleBulletList}>
                <List className="w-3.5 h-3.5" />
              </ToolbarButton>
              <ToolbarButton label="Numbered list" onClick={handleOrderedList}>
                <ListOrdered className="w-3.5 h-3.5" />
              </ToolbarButton>
              <div className="w-px h-4 bg-[#2A2A2A] mx-0.5" />
              <ToolbarButton label="Insert link" onClick={handleLink}>
                <Link className="w-3.5 h-3.5" />
              </ToolbarButton>
              <ToolbarButton label="Code block" onClick={handleCodeBlock}>
                <Code2 className="w-3.5 h-3.5" />
              </ToolbarButton>
            </div>

            {files.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-3 pt-2">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 bg-[#252525] border border-[#2A2A2A] rounded-lg px-2 py-1 text-xs text-[#E5E7EB]"
                  >
                    {fileIcon(f.type)}
                    <span className="max-w-[120px] truncate">{f.name}</span>
                    <span className="text-[#6B7280]">{formatBytes(f.size)}</span>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="text-[#6B7280] hover:text-white transition-colors"
                      aria-label={`Remove ${f.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || sending}
              rows={1}
              className={cn(
                "w-full bg-transparent outline-none resize-none text-base text-white",
                "placeholder:text-[#6B7280] px-3 py-2 leading-relaxed",
                "disabled:opacity-50",
              )}
              style={{ minHeight: "36px", maxHeight: "160px", fontSize: "16px" }}
              aria-label={placeholder}
            />

            <div className="flex items-center justify-between px-2 pb-2">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled || files.length >= MAX_FILES}
                  className="p-1.5 rounded text-[#9CA3AF] hover:bg-[#252525] hover:text-white transition-colors disabled:opacity-40"
                  aria-label="Attach file"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <EmojiPicker
                  onSelect={(emoji) => {
                    setValue((prev) => {
                      if (prev.length + 2 > CHAR_LIMIT) return prev;
                      return prev + emoji;
                    });
                    textareaRef.current?.focus();
                  }}
                  trigger={
                    <button
                      type="button"
                      className="p-1.5 rounded text-[#9CA3AF] hover:bg-[#252525] hover:text-white transition-colors"
                      aria-label="Insert emoji"
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                  }
                />
              </div>

              <div className="flex items-center gap-2">
                {showCounter && (
                  <span
                    className={cn("text-xs", charsLeft < 200 ? "text-red-400" : "text-[#9CA3AF]")}
                  >
                    {charsLeft}
                  </span>
                )}
                {showMic ? (
                  <button
                    type="button"
                    onClick={() => setVoiceRecording(true)}
                    disabled={disabled}
                    className="p-1.5 rounded-lg bg-[#252525] text-[#9CA3AF] hover:bg-[#2A2A2A] hover:text-white transition-colors disabled:opacity-40"
                    aria-label="Record voice note"
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!canSend}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      canSend
                        ? "bg-primary text-white hover:bg-primary/90"
                        : "bg-[#252525] text-[#6B7280] cursor-not-allowed",
                    )}
                    aria-label="Send message"
                  >
                    <SendHorizonal className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_TYPES}
            onChange={handleFileInput}
            className="hidden"
            aria-hidden="true"
          />
        </>
      )}
    </div>
  );
}
