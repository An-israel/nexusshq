import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { useMessagingCtx } from "@/routes/_app.$workspaceSlug.messages";
import { DmView } from "@/components/messages/DmView";
import { toast } from "sonner";
import type { DmConversationWithMeta, DmMember, MsgProfile } from "@/lib/messaging/types";

export const Route = createFileRoute("/_app/$workspaceSlug/messages/dm/$conversationId")({
  component: DmViewPage,
});

function DmViewPage() {
  const { conversationId, workspaceSlug } = Route.useParams();
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const { workspaceMembers, presence, onMobileBack } = useMessagingCtx();
  const navigate = useNavigate();

  const workspaceId = workspace?.id ?? null;
  const currentUserId = user?.id ?? null;

  const [conversation, setConversation] = React.useState<DmConversationWithMeta | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);

  React.useEffect(() => {
    if (!workspaceId || !conversationId) return;
    setLoading(true);
    setConversation(null);
    setLoadError(false);

    async function load() {
      const [convRes, membersRes] = await Promise.all([
        supabase
          .from("dm_conversations")
          .select("id,workspace_id,type,name,created_by,last_message_at,created_at")
          .eq("id", conversationId)
          .single(),
        supabase
          .from("dm_members")
          .select("id,conversation_id,user_id,last_read_at,is_muted")
          .eq("conversation_id", conversationId),
      ]);

      if (convRes.error || !convRes.data) {
        console.error("DmViewPage: failed to load conversation", convRes.error?.message);
        setLoadError(true);
        setLoading(false);
        return;
      }

      const rawMembers = (membersRes.data ?? []) as {
        id: string;
        conversation_id: string;
        user_id: string;
        last_read_at: string;
        is_muted: boolean;
      }[];

      const memberUserIds = rawMembers.map((m) => m.user_id);
      const profilesRes = memberUserIds.length
        ? await supabase
            .from("profiles")
            .select("id,full_name,email,avatar_url,department,job_title")
            .in("id", memberUserIds)
        : { data: [] };

      const profileMap = new Map<string, MsgProfile>();
      for (const p of profilesRes.data ?? []) {
        profileMap.set(p.id, p as unknown as MsgProfile);
      }

      const members: DmMember[] = rawMembers.map((m) => ({
        id: m.id,
        conversation_id: m.conversation_id,
        user_id: m.user_id,
        last_read_at: m.last_read_at,
        is_muted: m.is_muted,
        profile: profileMap.get(m.user_id),
      }));

      const conv = convRes.data as any;

      setConversation({
        id: conv.id,
        workspace_id: conv.workspace_id,
        type: conv.type as "direct" | "group",
        name: conv.name,
        created_by: conv.created_by,
        last_message_at: conv.last_message_at,
        created_at: conv.created_at,
        unread_count: 0,
        members,
      });

      setLoading(false);
    }

    load();
  }, [conversationId, workspaceId]);

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-sm text-muted-foreground">Couldn't open this conversation.</p>
        <button
          type="button"
          onClick={() => {
            onMobileBack();
            navigate({ to: `/${workspaceSlug}/messages` as any });
          }}
          className="text-sm text-primary underline"
        >
          Go back
        </button>
      </div>
    );
  }

  if (loading || !conversation || !workspaceId || !currentUserId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <DmView
      conversation={conversation}
      workspaceId={workspaceId}
      workspaceSlug={workspaceSlug}
      currentUserId={currentUserId}
      workspaceMembers={workspaceMembers}
      presence={presence}
    />
  );
}
