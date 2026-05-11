import React from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { DmConversationWithMeta, DmMember, MsgProfile } from "./types";

type RawConversation = {
  id: string;
  workspace_id: string;
  type: "direct" | "group";
  name: string | null;
  created_by: string | null;
  last_message_at: string;
  created_at: string;
};

type RawDmMember = {
  id: string;
  conversation_id: string;
  user_id: string;
  last_read_at: string;
  is_muted: boolean;
};

type RawMessage = {
  conversation_id: string | null;
  created_at: string;
  sender_id: string;
};

export function useDmConversations(
  workspaceId: string | null,
  userId: string | null
): {
  conversations: DmConversationWithMeta[];
  loading: boolean;
  startDm: (targetUserIds: string[]) => Promise<string>;
  markConversationRead: (conversationId: string) => Promise<void>;
  refetch: () => void;
} {
  const [conversations, setConversations] = React.useState<
    DmConversationWithMeta[]
  >([]);
  const [loading, setLoading] = React.useState(false);

  const fetchConversations = React.useCallback(async () => {
    if (!workspaceId || !userId) {
      setConversations([]);
      return;
    }

    setLoading(true);
    try {
      const myMembershipsRes = await supabase
        .from("dm_members")
        .select("conversation_id")
        .eq("user_id", userId);

      // Treat RLS/permission errors as empty — user has no conversations yet
      if (myMembershipsRes.error) {
        console.warn("dm_members query:", myMembershipsRes.error.message);
        setConversations([]);
        return;
      }

      const convIds = (myMembershipsRes.data ?? []).map(
        (r: { conversation_id: string }) => r.conversation_id
      );
      if (convIds.length === 0) {
        setConversations([]);
        return;
      }

      const [convsRes, allMembersRes] = await Promise.all([
        supabase
          .from("dm_conversations")
          .select(
            "id,workspace_id,type,name,created_by,last_message_at,created_at"
          )
          .in("id", convIds)
          .eq("workspace_id", workspaceId)
          .order("last_message_at", { ascending: false }),
        supabase
          .from("dm_members")
          .select("id,conversation_id,user_id,last_read_at,is_muted")
          .in("conversation_id", convIds),
      ]);

      if (convsRes.error) {
        console.warn("dm_conversations query:", convsRes.error.message);
        setConversations([]);
        return;
      }
      if (allMembersRes.error) {
        console.warn("dm_members all query:", allMembersRes.error.message);
        setConversations([]);
        return;
      }

      const rawConvs = (convsRes.data ?? []) as RawConversation[];
      const allMembers = (allMembersRes.data ?? []) as RawDmMember[];

      const memberUserIds = Array.from(
        new Set(allMembers.map((m) => m.user_id))
      );
      const profilesRes = memberUserIds.length
        ? await supabase
            .from("profiles")
            .select("id,full_name,email,avatar_url,department,job_title")
            .in("id", memberUserIds)
        : { data: [], error: null };

      const profileMap = new Map<string, MsgProfile>();
      for (const p of profilesRes.data ?? []) {
        profileMap.set(p.id, p as unknown as MsgProfile);
      }

      const membersByConv = new Map<string, RawDmMember[]>();
      for (const m of allMembers) {
        const arr = membersByConv.get(m.conversation_id) ?? [];
        arr.push(m);
        membersByConv.set(m.conversation_id, arr);
      }

      const myMemberByConv = new Map<string, RawDmMember>();
      for (const m of allMembers) {
        if (m.user_id === userId) {
          myMemberByConv.set(m.conversation_id, m);
        }
      }

      const readTimes = Array.from(myMemberByConv.values()).map(
        (m) => m.last_read_at
      );
      const oldestReadAt =
        readTimes.length > 0
          ? readTimes.reduce((a, b) => (a < b ? a : b))
          : new Date().toISOString();

      // Filter messages by conversation_id only — avoids workspace_id RLS issues
      const messagesRes = await supabase
        .from("messages")
        .select("conversation_id,created_at,sender_id")
        .in("conversation_id", convIds)
        .gt("created_at", oldestReadAt)
        .eq("is_deleted", false)
        .is("parent_message_id", null);

      const rawMessages = (messagesRes.data ?? []) as RawMessage[];
      const messagesByConv = new Map<string, RawMessage[]>();
      for (const msg of rawMessages) {
        if (!msg.conversation_id) continue;
        const arr = messagesByConv.get(msg.conversation_id) ?? [];
        arr.push(msg);
        messagesByConv.set(msg.conversation_id, arr);
      }

      const result: DmConversationWithMeta[] = rawConvs.map((conv) => {
        const myMember = myMemberByConv.get(conv.id);
        const lastReadAt = myMember?.last_read_at ?? new Date(0).toISOString();
        const convMessages = messagesByConv.get(conv.id) ?? [];
        const unreadCount = convMessages.filter(
          (msg) => msg.sender_id !== userId && msg.created_at > lastReadAt
        ).length;

        const members: DmMember[] = (membersByConv.get(conv.id) ?? []).map(
          (m) => ({
            id: m.id,
            conversation_id: m.conversation_id,
            user_id: m.user_id,
            last_read_at: m.last_read_at,
            is_muted: m.is_muted,
            profile: profileMap.get(m.user_id),
          })
        );

        return {
          ...conv,
          unread_count: unreadCount,
          members,
        };
      });

      setConversations(result);
    } catch (err) {
      console.error("useDmConversations fetch error:", err);
      // Only show toast for unexpected errors, not RLS/permission ones
      const msg = (err as Error).message ?? "";
      if (!msg.includes("permission") && !msg.includes("policy") && !msg.includes("RLS")) {
        toast.error("Failed to load conversations");
      }
    } finally {
      setLoading(false);
    }
  }, [workspaceId, userId]);

  React.useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  React.useEffect(() => {
    if (!workspaceId || !userId) return;

    const channel = supabase
      .channel(`dm-conversations-${workspaceId}-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dm_members",
        },
        () => {
          fetchConversations();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, userId, fetchConversations]);

  const startDm = React.useCallback(
    async (targetUserIds: string[]): Promise<string> => {
      if (!workspaceId || !userId) throw new Error("Not authenticated");

      const allUserIds = Array.from(new Set([userId, ...targetUserIds]));
      const isDirect = targetUserIds.length === 1;

      if (isDirect) {
        const otherId = targetUserIds[0];

        const myConvsRes = await supabase
          .from("dm_members")
          .select("conversation_id")
          .eq("user_id", userId);

        if (myConvsRes.error) throw myConvsRes.error;

        const myConvIds = (myConvsRes.data ?? []).map(
          (r: { conversation_id: string }) => r.conversation_id
        );

        if (myConvIds.length > 0) {
          const otherConvsRes = await supabase
            .from("dm_members")
            .select("conversation_id")
            .eq("user_id", otherId)
            .in("conversation_id", myConvIds);

          if (otherConvsRes.error) throw otherConvsRes.error;

          const sharedConvIds = (otherConvsRes.data ?? []).map(
            (r: { conversation_id: string }) => r.conversation_id
          );

          if (sharedConvIds.length > 0) {
            for (const convId of sharedConvIds) {
              const membersRes = await supabase
                .from("dm_members")
                .select("user_id")
                .eq("conversation_id", convId);

              if (membersRes.error) continue;

              const memberIds = (membersRes.data ?? []).map(
                (r: { user_id: string }) => r.user_id
              );
              if (memberIds.length === 2) {
                return convId;
              }
            }
          }
        }
      }

      const { data: convData, error: convErr } = await supabase
        .from("dm_conversations")
        .insert({
          workspace_id: workspaceId,
          type: isDirect ? "direct" : "group",
          created_by: userId,
        })
        .select()
        .single();

      if (convErr) throw convErr;

      const newConvId = (convData as unknown as { id: string }).id;

      const memberInserts = allUserIds.map((uid) => ({
        conversation_id: newConvId,
        user_id: uid,
      }));

      const { error: membersErr } = await supabase
        .from("dm_members")
        .insert(memberInserts);

      if (membersErr) throw membersErr;

      await fetchConversations();
      return newConvId;
    },
    [workspaceId, userId, fetchConversations]
  );

  const markConversationRead = React.useCallback(
    async (conversationId: string) => {
      if (!userId) return;
      const { error } = await supabase
        .from("dm_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("user_id", userId);
      if (error) {
        console.error("markConversationRead error:", error);
        return;
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, unread_count: 0 } : c
        )
      );
    },
    [userId]
  );

  return {
    conversations,
    loading,
    startDm,
    markConversationRead,
    refetch: fetchConversations,
  };
}
