import React from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { notifyMentions, notifyPinChange } from "./notify";
import type { Message, MsgProfile, MessageReaction, MessageAttachment, VoiceNote } from "./types";

const PAGE_SIZE = 50;

type RawMessage = {
  id: string;
  workspace_id: string;
  channel_id: string | null;
  conversation_id: string | null;
  sender_id: string;
  body: string;
  body_html: string | null;
  parent_message_id: string | null;
  thread_reply_count: number;
  thread_last_reply_at: string | null;
  is_edited: boolean;
  edited_at: string | null;
  is_deleted: boolean;
  pinned: boolean;
  pinned_by: string | null;
  has_attachment: boolean;
  created_at: string;
};

type RawReaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

type RawAttachment = {
  id: string;
  message_id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: number;
  google_drive_file_id: string | null;
  google_drive_view_url: string | null;
  storage_path: string | null;
  thumbnail_url: string | null;
  created_at: string;
};

type RawVoiceNote = {
  id: string;
  workspace_id: string;
  message_id: string;
  sender_id: string | null;
  storage_path: string;
  public_url: string;
  duration_seconds: number | null;
  waveform_data: number[] | null;
  transcription: string | null;
  transcription_status: "pending" | "processing" | "completed" | "failed";
  file_size_bytes: number | null;
  created_at: string;
};

async function loadProfiles(userIds: string[]): Promise<Map<string, MsgProfile>> {
  const unique = Array.from(new Set(userIds));
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email,avatar_url,department,job_title")
    .in("id", unique);
  if (error) {
    console.error("loadProfiles error:", error);
    return new Map();
  }
  const map = new Map<string, MsgProfile>();
  for (const row of data ?? []) {
    map.set(row.id, row as unknown as MsgProfile);
  }
  return map;
}

async function enrichMessages(rawMsgs: RawMessage[]): Promise<Message[]> {
  if (rawMsgs.length === 0) return [];

  const msgIds = rawMsgs.map((m) => m.id);
  const senderIds = rawMsgs.map((m) => m.sender_id);

  const [profileMap, reactionsRes, attachmentsRes, voiceNotesRes] = await Promise.all([
    loadProfiles(senderIds),
    supabase
      .from("message_reactions")
      .select("id,message_id,user_id,emoji,created_at")
      .in("message_id", msgIds),
    supabase
      .from("message_attachments")
      .select(
        "id,message_id,file_name,file_type,file_size_bytes,google_drive_file_id,google_drive_view_url,storage_path,thumbnail_url,created_at",
      )
      .in("message_id", msgIds),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("voice_notes")
      .select(
        "id,workspace_id,message_id,sender_id,storage_path,public_url,duration_seconds,waveform_data,transcription,transcription_status,file_size_bytes,created_at",
      )
      .in("message_id", msgIds),
  ]);

  const rawReactions = (reactionsRes.data ?? []) as RawReaction[];
  const rawAttachments = (attachmentsRes.data ?? []) as RawAttachment[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawVoiceNotes = ((voiceNotesRes as any).data ?? []) as RawVoiceNote[];

  const reactionUserIds = rawReactions.map((r) => r.user_id);
  const reactionProfileMap = await loadProfiles(reactionUserIds);

  const reactionsByMessage = new Map<string, MessageReaction[]>();
  for (const r of rawReactions) {
    const arr = reactionsByMessage.get(r.message_id) ?? [];
    arr.push({ ...r, profile: reactionProfileMap.get(r.user_id) });
    reactionsByMessage.set(r.message_id, arr);
  }

  const attachmentsByMessage = new Map<string, MessageAttachment[]>();
  for (const a of rawAttachments) {
    const arr = attachmentsByMessage.get(a.message_id) ?? [];
    arr.push(a as MessageAttachment);
    attachmentsByMessage.set(a.message_id, arr);
  }

  const voiceNoteByMessage = new Map<string, VoiceNote>();
  for (const vn of rawVoiceNotes) {
    voiceNoteByMessage.set(vn.message_id, vn as VoiceNote);
  }

  return rawMsgs.map((m) => ({
    ...m,
    sender: profileMap.get(m.sender_id),
    reactions: reactionsByMessage.get(m.id) ?? [],
    attachments: attachmentsByMessage.get(m.id) ?? [],
    voice_note: voiceNoteByMessage.get(m.id),
  }));
}

export function useMessages(params: {
  workspaceId: string | null;
  channelId?: string | null;
  conversationId?: string | null;
  parentMessageId?: string | null;
}): {
  messages: Message[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void;
  sendMessage: (body: string, files?: File[]) => Promise<void>;
  sendVoiceNote: (blob: Blob, duration: number, waveformData: number[]) => Promise<void>;
  editMessage: (id: string, body: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  pinMessage: (id: string, pinned: boolean) => Promise<void>;
} {
  const { workspaceId, channelId, conversationId, parentMessageId } = params;

  const [messages, setMessages] = React.useState<Message[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(false);
  const oldestCreatedAtRef = React.useRef<string | null>(null);

  const buildBaseQuery = React.useCallback(() => {
    let q = supabase
      .from("messages")
      .select(
        "id,workspace_id,channel_id,conversation_id,sender_id,body,body_html,parent_message_id,thread_reply_count,thread_last_reply_at,is_edited,edited_at,is_deleted,pinned,pinned_by,has_attachment,created_at",
      )
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (parentMessageId) {
      q = q.eq("parent_message_id", parentMessageId);
    } else if (channelId) {
      q = q.eq("channel_id", channelId).is("parent_message_id", null);
    } else if (conversationId) {
      q = q.eq("conversation_id", conversationId).is("parent_message_id", null);
    }

    return q;
  }, [channelId, conversationId, parentMessageId]);

  const fetchInitial = React.useCallback(async () => {
    if (!workspaceId) {
      setMessages([]);
      return;
    }
    if (!channelId && !conversationId && !parentMessageId) {
      setMessages([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await buildBaseQuery();
      if (error) throw error;

      const raw = (data ?? []) as RawMessage[];
      const ordered = [...raw].reverse();

      if (ordered.length > 0) {
        oldestCreatedAtRef.current = ordered[0].created_at;
      }

      setHasMore(raw.length === PAGE_SIZE);
      const enriched = await enrichMessages(ordered);
      setMessages(enriched);
    } catch (err) {
      console.error("useMessages fetchInitial error:", err);
      toast.error("Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, channelId, conversationId, parentMessageId, buildBaseQuery]);

  React.useEffect(() => {
    oldestCreatedAtRef.current = null;
    setMessages([]);
    setHasMore(false);
    fetchInitial();
  }, [fetchInitial]);

  const loadMore = React.useCallback(async () => {
    if (!oldestCreatedAtRef.current || !hasMore) return;

    try {
      const q = buildBaseQuery().lt("created_at", oldestCreatedAtRef.current);
      const { data, error } = await q;
      if (error) throw error;

      const raw = (data ?? []) as RawMessage[];
      const ordered = [...raw].reverse();

      if (ordered.length > 0) {
        oldestCreatedAtRef.current = ordered[0].created_at;
      }

      setHasMore(raw.length === PAGE_SIZE);
      const enriched = await enrichMessages(ordered);
      setMessages((prev) => [...enriched, ...prev]);
    } catch (err) {
      console.error("loadMore error:", err);
      toast.error("Failed to load more messages");
    }
  }, [hasMore, buildBaseQuery]);

  React.useEffect(() => {
    if (!workspaceId) return;
    if (!channelId && !conversationId && !parentMessageId) return;

    const filterParts: string[] = [];
    if (channelId) filterParts.push(`channel_id=eq.${channelId}`);
    else if (conversationId) filterParts.push(`conversation_id=eq.${conversationId}`);

    const realtimeChannel = supabase
      .channel(
        `messages-${workspaceId}-${channelId ?? conversationId ?? parentMessageId ?? "none"}`,
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          ...(filterParts.length > 0 ? { filter: filterParts[0] } : {}),
        },
        async (payload) => {
          const newRaw = payload.new as RawMessage;
          if (parentMessageId) {
            if (newRaw.parent_message_id !== parentMessageId) return;
          } else {
            if (newRaw.parent_message_id !== null) return;
            if (channelId && newRaw.channel_id !== channelId) return;
            if (conversationId && newRaw.conversation_id !== conversationId) return;
          }
          const enriched = await enrichMessages([newRaw]);
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === newRaw.id);
            if (exists) return prev;
            return [...prev, ...enriched];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          ...(filterParts.length > 0 ? { filter: filterParts[0] } : {}),
        },
        async (payload) => {
          const updatedRaw = payload.new as RawMessage;
          const enriched = await enrichMessages([updatedRaw]);
          const updated = enriched[0];
          if (!updated) return;
          if (updatedRaw.is_deleted) {
            setMessages((prev) => prev.filter((m) => m.id !== updatedRaw.id));
          } else {
            setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(realtimeChannel);
    };
  }, [workspaceId, channelId, conversationId, parentMessageId]);

  const sendMessage = React.useCallback(
    async (body: string, files?: File[]) => {
      if (!workspaceId) return;

      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) {
        toast.error("Not authenticated");
        return;
      }

      const optimisticId = crypto.randomUUID();
      const now = new Date().toISOString();
      const optimistic: Message = {
        id: optimisticId,
        workspace_id: workspaceId,
        channel_id: channelId ?? null,
        conversation_id: conversationId ?? null,
        sender_id: user.id,
        body,
        body_html: null,
        parent_message_id: parentMessageId ?? null,
        thread_reply_count: 0,
        thread_last_reply_at: null,
        is_edited: false,
        edited_at: null,
        is_deleted: false,
        pinned: false,
        pinned_by: null,
        has_attachment: (files?.length ?? 0) > 0,
        created_at: now,
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        const insertPayload: Record<string, unknown> = {
          workspace_id: workspaceId,
          sender_id: user.id,
          body,
          has_attachment: (files?.length ?? 0) > 0,
        };
        if (channelId) insertPayload["channel_id"] = channelId;
        if (conversationId) insertPayload["conversation_id"] = conversationId;
        if (parentMessageId) insertPayload["parent_message_id"] = parentMessageId;

        // Retry with exponential backoff on transient errors (network blips,
        // 5xx). Workspace-scoped RLS still applies — a true permission denial
        // is not retried (PostgREST returns 4xx with code starting "42" or
        // "PGRST"). This prevents silent cross-workspace exposure.
        let msgData: unknown = null;
        let lastErr: { message?: string; code?: string } | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const res = await supabase
            .from("messages")
            .insert(insertPayload as never)
            .select()
            .single();
          if (!res.error) {
            msgData = res.data;
            lastErr = null;
            break;
          }
          lastErr = res.error;
          const code = res.error.code ?? "";
          const isPermOrValidation =
            code.startsWith("42") || code.startsWith("PGRST") || code === "23514";
          if (isPermOrValidation) break;
          await new Promise((r) => setTimeout(r, 250 * Math.pow(2, attempt)));
        }
        if (lastErr) throw lastErr;

        const insertedMsg = msgData as unknown as RawMessage;

        if (files && files.length > 0) {
          const containerId = channelId ?? conversationId ?? "misc";
          const attachmentInserts = await Promise.all(
            files.map(async (file) => {
              const ext = file.name.split(".").pop() ?? "";
              const safeName = `${crypto.randomUUID()}.${ext}`;
              const storagePath = `${workspaceId}/${containerId}/${safeName}`;
              const { error: uploadErr } = await supabase.storage
                .from("message-attachments")
                .upload(storagePath, file);
              if (uploadErr) {
                console.error("File upload error:", uploadErr);
                return null;
              }
              const { data: urlData } = supabase.storage
                .from("message-attachments")
                .getPublicUrl(storagePath);
              return {
                message_id: insertedMsg.id,
                file_name: file.name,
                file_type: file.type,
                file_size_bytes: file.size,
                storage_path: storagePath,
                thumbnail_url: urlData?.publicUrl ?? null,
              };
            }),
          );
          const validAttachments = attachmentInserts.filter(
            (a): a is NonNullable<typeof a> => a !== null,
          );
          if (validAttachments.length > 0) {
            const { error: attErr } = await supabase
              .from("message_attachments")
              .insert(validAttachments);
            if (attErr) console.error("Attachment insert error:", attErr);
          }
        }

        const enriched = await enrichMessages([insertedMsg]);
        const real = enriched[0];
        if (real) {
          setMessages((prev) => prev.map((m) => (m.id === optimisticId ? real : m)));
        }

        // Fire-and-forget: in-app notifications for @mentions in channel messages.
        if (channelId && body.includes("@")) {
          void notifyMentions({
            workspaceId,
            channelId,
            messageId: insertedMsg.id,
            senderId: user.id,
            body,
          });
        }
      } catch (err) {
        console.error("sendMessage error:", err);
        toast.error("Failed to send message");
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      }
    },
    [workspaceId, channelId, conversationId, parentMessageId],
  );

  const editMessage = React.useCallback(async (id: string, body: string) => {
    const { error } = await supabase
      .from("messages")
      .update({
        body,
        is_edited: true,
        edited_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) {
      console.error("editMessage error:", error);
      toast.error("Failed to edit message");
      return;
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, body, is_edited: true, edited_at: new Date().toISOString() } : m,
      ),
    );
  }, []);

  const deleteMessage = React.useCallback(async (id: string) => {
    const { error } = await supabase.from("messages").update({ is_deleted: true }).eq("id", id);
    if (error) {
      console.error("deleteMessage error:", error);
      toast.error("Failed to delete message");
      return;
    }
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const pinMessage = React.useCallback(
    async (id: string, pinned: boolean) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("messages")
        .update({
          pinned,
          pinned_by: pinned ? (user?.id ?? null) : null,
        })
        .eq("id", id);
      if (error) {
        console.error("pinMessage error:", error);
        toast.error("Failed to pin message");
        return;
      }
      toast.success(pinned ? "Message pinned" : "Message unpinned");
      const target = messages.find((m) => m.id === id);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, pinned, pinned_by: pinned ? (user?.id ?? null) : null } : m,
        ),
      );
      if (workspaceId && user && target) {
        void notifyPinChange({
          workspaceId,
          channelId: channelId ?? null,
          conversationId: conversationId ?? null,
          messageId: id,
          actorId: user.id,
          pinned,
          body: target.body,
        });
      }
    },
    [workspaceId, channelId, conversationId, messages],
  );

  const sendVoiceNote = React.useCallback(
    async (blob: Blob, duration: number, waveformData: number[]) => {
      if (!workspaceId) return;

      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser();
      if (authErr || !user) {
        toast.error("Not authenticated");
        return;
      }

      const optimisticId = crypto.randomUUID();
      const now = new Date().toISOString();
      const optimistic: Message = {
        id: optimisticId,
        workspace_id: workspaceId,
        channel_id: channelId ?? null,
        conversation_id: conversationId ?? null,
        sender_id: user.id,
        body: "[Voice Note]",
        body_html: null,
        parent_message_id: parentMessageId ?? null,
        thread_reply_count: 0,
        thread_last_reply_at: null,
        is_edited: false,
        edited_at: null,
        is_deleted: false,
        pinned: false,
        pinned_by: null,
        has_attachment: false,
        created_at: now,
      };
      setMessages((prev) => [...prev, optimistic]);

      try {
        const insertPayload: Record<string, unknown> = {
          workspace_id: workspaceId,
          sender_id: user.id,
          body: "[Voice Note]",
          has_attachment: false,
        };
        if (channelId) insertPayload["channel_id"] = channelId;
        if (conversationId) insertPayload["conversation_id"] = conversationId;
        if (parentMessageId) insertPayload["parent_message_id"] = parentMessageId;

        const { data: msgData, error: msgErr } = await supabase
          .from("messages")
          .insert(insertPayload as never)
          .select()
          .single();
        if (msgErr) throw msgErr;

        const insertedMsg = msgData as unknown as { id: string } & typeof optimistic;

        const ext = blob.type.includes("ogg") ? "ogg" : blob.type.includes("mp4") ? "mp4" : "webm";
        const containerId = channelId ?? conversationId ?? "misc";
        const storagePath = `${workspaceId}/${containerId}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("voice-notes")
          .upload(storagePath, blob, { contentType: blob.type });
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage.from("voice-notes").getPublicUrl(storagePath);
        const publicUrl = urlData?.publicUrl ?? "";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const vnRes = await (supabase as any)
          .from("voice_notes")
          .insert({
            workspace_id: workspaceId,
            message_id: (insertedMsg as unknown as { id: string }).id,
            sender_id: user.id,
            storage_path: storagePath,
            public_url: publicUrl,
            duration_seconds: Math.round(duration),
            waveform_data: waveformData,
            file_size_bytes: blob.size,
            transcription_status: "pending",
          })
          .select()
          .single();
        if (vnRes.error) throw vnRes.error;
        const vnData = vnRes.data as RawVoiceNote;

        // Fire-and-forget transcription
        void fetch("/api/transcribe-voice-note", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ voiceNoteId: vnData.id, publicUrl }),
        }).catch((e) => console.error("transcription request failed:", e));

        const enriched = await enrichMessages([insertedMsg as unknown as typeof optimistic]);
        const real = enriched[0];
        if (real) {
          real.voice_note = vnData as unknown as VoiceNote;
          setMessages((prev) => prev.map((m) => (m.id === optimisticId ? real : m)));
        }
      } catch (err) {
        console.error("sendVoiceNote error:", err);
        toast.error("Failed to send voice note");
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      }
    },
    [workspaceId, channelId, conversationId, parentMessageId],
  );

  return {
    messages,
    loading,
    hasMore,
    loadMore,
    sendMessage,
    sendVoiceNote,
    editMessage,
    deleteMessage,
    pinMessage,
  };
}
