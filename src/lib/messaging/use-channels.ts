import React from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ChannelWithMeta } from "./types";

type RawChannel = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  type: "public" | "private" | "announcement";
  created_by: string | null;
  is_default: boolean;
  is_archived: boolean;
  created_at: string;
};

type RawChannelMember = {
  channel_id: string;
  user_id: string;
  last_read_at: string;
  is_muted: boolean;
};

type RawMessage = {
  channel_id: string;
  created_at: string;
  sender_id: string;
};

export function useChannels(
  workspaceId: string | null,
  userId: string | null
): {
  channels: ChannelWithMeta[];
  joinedChannels: ChannelWithMeta[];
  publicChannels: ChannelWithMeta[];
  loading: boolean;
  joinChannel: (channelId: string) => Promise<void>;
  markChannelRead: (channelId: string) => Promise<void>;
  refetch: () => void;
} {
  const [channels, setChannels] = React.useState<ChannelWithMeta[]>([]);
  const [loading, setLoading] = React.useState(false);

  const fetchChannels = React.useCallback(async () => {
    if (!workspaceId || !userId) {
      setChannels([]);
      return;
    }

    setLoading(true);
    try {
      const [channelsRes, membersRes] = await Promise.all([
        supabase
          .from("channels")
          .select("id,workspace_id,name,description,type,created_by,is_default,is_archived,created_at")
          .eq("workspace_id", workspaceId)
          .eq("is_archived", false),
        supabase
          .from("channel_members")
          .select("channel_id,user_id,last_read_at,is_muted")
          .eq("workspace_id", workspaceId),
      ]);

      if (channelsRes.error) throw channelsRes.error;
      if (membersRes.error) throw membersRes.error;

      const rawChannels = (channelsRes.data ?? []) as RawChannel[];
      const allMembers = (membersRes.data ?? []) as RawChannelMember[];

      const membersByChannel = new Map<string, RawChannelMember[]>();
      for (const m of allMembers) {
        const arr = membersByChannel.get(m.channel_id) ?? [];
        arr.push(m);
        membersByChannel.set(m.channel_id, arr);
      }

      const myMemberByChannel = new Map<string, RawChannelMember>();
      for (const m of allMembers) {
        if (m.user_id === userId) {
          myMemberByChannel.set(m.channel_id, m);
        }
      }

      const channelIds = rawChannels.map((c) => c.id);
      if (channelIds.length === 0) {
        setChannels([]);
        return;
      }

      const myReadTimes = Array.from(myMemberByChannel.values()).map(
        (m) => m.last_read_at
      );
      const oldestReadAt =
        myReadTimes.length > 0
          ? myReadTimes.reduce((a, b) => (a < b ? a : b))
          : new Date().toISOString();

      const messagesRes = await supabase
        .from("messages")
        .select("channel_id,created_at,sender_id")
        .in("channel_id", channelIds)
        .gt("created_at", oldestReadAt)
        .eq("is_deleted", false)
        .is("parent_message_id", null);

      if (messagesRes.error) throw messagesRes.error;

      const rawMessages = (messagesRes.data ?? []) as RawMessage[];

      const messagesByChannel = new Map<string, RawMessage[]>();
      for (const msg of rawMessages) {
        if (!msg.channel_id) continue;
        const arr = messagesByChannel.get(msg.channel_id) ?? [];
        arr.push(msg);
        messagesByChannel.set(msg.channel_id, arr);
      }

      const result: ChannelWithMeta[] = rawChannels.map((ch) => {
        const myMember = myMemberByChannel.get(ch.id);
        const isMember = !!myMember;
        const memberCount = (membersByChannel.get(ch.id) ?? []).length;
        const channelMessages = messagesByChannel.get(ch.id) ?? [];
        const lastReadAt = myMember?.last_read_at ?? new Date(0).toISOString();
        const unreadCount = channelMessages.filter(
          (msg) => msg.sender_id !== userId && msg.created_at > lastReadAt
        ).length;

        return {
          ...ch,
          is_member: isMember,
          member_count: memberCount,
          unread_count: unreadCount,
          mention_count: 0,
        };
      });

      setChannels(result);
    } catch (err) {
      console.error("useChannels fetch error:", err);
      toast.error("Failed to load channels");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, userId]);

  React.useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  React.useEffect(() => {
    if (!workspaceId) return;

    const msgChannel = supabase
      .channel(`channels-messages-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          fetchChannels();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channel_members",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        () => {
          fetchChannels();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
    };
  }, [workspaceId, fetchChannels]);

  const joinChannel = React.useCallback(
    async (channelId: string) => {
      if (!userId || !workspaceId) return;
      const { error } = await supabase.from("channel_members").insert({
        channel_id: channelId,
        user_id: userId,
        workspace_id: workspaceId,
      });
      if (error) {
        console.error("joinChannel error:", error);
        toast.error("Failed to join channel");
        return;
      }
      await fetchChannels();
    },
    [userId, workspaceId, fetchChannels]
  );

  const markChannelRead = React.useCallback(
    async (channelId: string) => {
      if (!userId) return;
      const { error } = await supabase
        .from("channel_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("channel_id", channelId)
        .eq("user_id", userId);
      if (error) {
        console.error("markChannelRead error:", error);
        return;
      }
      setChannels((prev) =>
        prev.map((ch) =>
          ch.id === channelId ? { ...ch, unread_count: 0 } : ch
        )
      );
    },
    [userId]
  );

  const joinedChannels = React.useMemo(
    () => channels.filter((ch) => ch.is_member),
    [channels]
  );

  const publicChannels = React.useMemo(
    () =>
      channels.filter(
        (ch) => ch.type === "public" || ch.type === "announcement"
      ),
    [channels]
  );

  return {
    channels,
    joinedChannels,
    publicChannels,
    loading,
    joinChannel,
    markChannelRead,
    refetch: fetchChannels,
  };
}
