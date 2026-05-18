import React from "react";
import { supabase } from "@/integrations/supabase/client";

export function useReactions(currentUserId: string | null): {
  addReaction: (messageId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, emoji: string) => Promise<void>;
  toggleReaction: (messageId: string, emoji: string, hasMyReaction: boolean) => Promise<void>;
} {
  const addReaction = React.useCallback(
    async (messageId: string, emoji: string) => {
      if (!currentUserId) return;
      const { error } = await supabase.from("message_reactions").insert({
        message_id: messageId,
        user_id: currentUserId,
        emoji,
      });
      if (error && error.code !== "23505") {
        console.error("addReaction error:", error);
      }
    },
    [currentUserId],
  );

  const removeReaction = React.useCallback(
    async (messageId: string, emoji: string) => {
      if (!currentUserId) return;
      const { error } = await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_id", currentUserId)
        .eq("emoji", emoji);
      if (error) {
        console.error("removeReaction error:", error);
      }
    },
    [currentUserId],
  );

  const toggleReaction = React.useCallback(
    async (messageId: string, emoji: string, hasMyReaction: boolean) => {
      if (hasMyReaction) {
        await removeReaction(messageId, emoji);
      } else {
        await addReaction(messageId, emoji);
      }
    },
    [addReaction, removeReaction],
  );

  return { addReaction, removeReaction, toggleReaction };
}
