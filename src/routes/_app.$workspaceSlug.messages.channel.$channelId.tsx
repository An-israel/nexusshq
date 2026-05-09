import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { useMessagingCtx } from "@/routes/_app.$workspaceSlug.messages";
import { ChannelView } from "@/components/messages/ChannelView";
import type { ChannelWithMeta } from "@/lib/messaging/types";

export const Route = createFileRoute(
  "/_app/$workspaceSlug/messages/channel/$channelId"
)({
  component: ChannelViewPage,
});

function ChannelViewPage() {
  const { channelId } = Route.useParams();
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const { workspaceMembers, presence } = useMessagingCtx();

  const workspaceId = workspace?.id ?? null;
  const currentUserId = user?.id ?? null;

  const [channel, setChannel] = React.useState<ChannelWithMeta | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!workspaceId || !channelId) return;
    setLoading(true);
    setChannel(null);

    supabase
      .from("channels")
      .select("*")
      .eq("id", channelId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setChannel({
            ...data,
            type: data.type as "public" | "private" | "announcement",
            unread_count: 0,
            mention_count: 0,
            member_count: 0,
            is_member: true,
          });
        }
        setLoading(false);
      });
  }, [channelId, workspaceId]);

  if (loading || !channel || !workspaceId || !currentUserId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <ChannelView
      channel={channel}
      workspaceId={workspaceId}
      currentUserId={currentUserId}
      workspaceMembers={workspaceMembers}
      presence={presence}
    />
  );
}
