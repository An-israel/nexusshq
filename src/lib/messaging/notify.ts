import { supabase } from "@/integrations/supabase/client";

interface NotifyMentionsArgs {
  workspaceId: string;
  channelId: string;
  messageId: string;
  senderId: string;
  body: string;
}

/**
 * Parse @mentions out of a message body and create in-app notifications for
 * each matched workspace member (excluding the sender). Mentions are inserted
 * as `@<full_name>` by MessageInput, so we match against profiles.full_name
 * (case-insensitive) of active workspace members.
 *
 * Best-effort: failures are logged, never thrown.
 */
export async function notifyMentions({
  workspaceId,
  channelId,
  messageId,
  senderId,
  body,
}: NotifyMentionsArgs): Promise<void> {
  try {
    // Extract candidate mention strings: "@" followed by a name (letters,
    // digits, spaces, hyphens, apostrophes). Greedy until a non-name char.
    const matches = Array.from(
      body.matchAll(/@([\p{L}][\p{L}\p{N}'\- ]{0,60}?)(?=$|[^\p{L}\p{N}'\- ])/gu),
    );
    const candidates = new Set(matches.map((m) => m[1].trim().toLowerCase()).filter(Boolean));
    if (candidates.size === 0) return;

    const { data: members } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true);
    const userIds = (members ?? []).map((m) => m.user_id);
    if (userIds.length === 0) return;

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    const matched: { id: string; name: string }[] = [];
    for (const p of profiles ?? []) {
      const name = (p.full_name ?? p.email ?? "").trim().toLowerCase();
      if (!name || p.id === senderId) continue;
      // Match if any candidate mention starts-with this user's name (handles
      // greedy multi-word matches like "@John Doe says hi").
      for (const c of candidates) {
        if (
          c === name ||
          c.startsWith(name + " ") ||
          name.startsWith(c + " ") ||
          c.startsWith(name)
        ) {
          matched.push({ id: p.id, name: p.full_name ?? p.email ?? "Someone" });
          break;
        }
      }
    }
    if (matched.length === 0) return;

    // Filter out recipients who disabled mention notifications
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("user_id, mentions_enabled")
      .eq("workspace_id", workspaceId)
      .in(
        "user_id",
        matched.map((m) => m.id),
      );
    const disabled = new Set(
      (prefs ?? []).filter((p) => !p.mentions_enabled).map((p) => p.user_id),
    );
    const finalMatched = matched.filter((m) => !disabled.has(m.id));
    if (finalMatched.length === 0) return;

    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", senderId)
      .maybeSingle();
    const senderName = senderProfile?.full_name ?? senderProfile?.email ?? "Someone";

    const { data: channel } = await supabase
      .from("channels")
      .select("name")
      .eq("id", channelId)
      .maybeSingle();
    const channelName = channel?.name ?? "a channel";

    const preview = body.length > 140 ? body.slice(0, 140) + "…" : body;

    await supabase.from("notifications").insert(
      finalMatched.map((m) => ({
        user_id: m.id,
        workspace_id: workspaceId,
        type: "mention" as const,
        title: `${senderName} mentioned you in #${channelName}`,
        message: preview,
        related_task_id: null,
        // store messageId in metadata-style fallback: re-use related_task_id is
        // task-only, so we leave deep-linking to a future enhancement.
      })),
    );
    void messageId;
  } catch (err) {
    console.error("notifyMentions failed", err);
  }
}

interface NotifyPinArgs {
  workspaceId: string;
  channelId: string | null;
  conversationId: string | null;
  messageId: string;
  actorId: string;
  pinned: boolean;
  body: string;
}

/**
 * In-app notification for pin/unpin events. For channel messages, notify all
 * channel members (excluding the actor). For DMs, notify the other party.
 */
export async function notifyPinChange({
  workspaceId,
  channelId,
  conversationId,
  actorId,
  pinned,
  body,
}: NotifyPinArgs): Promise<void> {
  try {
    let recipients: string[] = [];
    let location = "a conversation";

    if (channelId) {
      const [{ data: members }, { data: channel }] = await Promise.all([
        supabase.from("channel_members").select("user_id").eq("channel_id", channelId),
        supabase.from("channels").select("name").eq("id", channelId).maybeSingle(),
      ]);
      recipients = (members ?? []).map((m) => m.user_id).filter((id) => id !== actorId);
      location = `#${channel?.name ?? "channel"}`;
    } else if (conversationId) {
      const { data: members } = await supabase
        .from("dm_members")
        .select("user_id")
        .eq("conversation_id", conversationId);
      recipients = (members ?? []).map((m) => m.user_id).filter((id) => id !== actorId);
      location = "your DM";
    }
    if (recipients.length === 0) return;

    // Filter out recipients who disabled pin notifications
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("user_id, pins_enabled")
      .eq("workspace_id", workspaceId)
      .in("user_id", recipients);
    const disabled = new Set((prefs ?? []).filter((p) => !p.pins_enabled).map((p) => p.user_id));
    recipients = recipients.filter((id) => !disabled.has(id));
    if (recipients.length === 0) return;

    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", actorId)
      .maybeSingle();
    const actorName = actorProfile?.full_name ?? actorProfile?.email ?? "Someone";

    const preview = body.length > 120 ? body.slice(0, 120) + "…" : body;

    await supabase.from("notifications").insert(
      recipients.map((uid) => ({
        user_id: uid,
        workspace_id: workspaceId,
        type: "info" as const,
        title: `${actorName} ${pinned ? "pinned" : "unpinned"} a message in ${location}`,
        message: preview,
      })),
    );
  } catch (err) {
    console.error("notifyPinChange failed", err);
  }
}
