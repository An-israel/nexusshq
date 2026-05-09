import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { useMessagingCtx } from "@/routes/_app.$workspaceSlug.messages";
import { ActivityFeed } from "@/components/messages/ActivityFeed";

export const Route = createFileRoute("/_app/$workspaceSlug/messages/activity")({
  component: ActivityPage,
});

function ActivityPage() {
  const { workspaceSlug } = Route.useParams();
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const { presence } = useMessagingCtx();

  const workspaceId = workspace?.id;
  const currentUserId = user?.id;

  if (!workspaceId || !currentUserId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <ActivityFeed
      workspaceId={workspaceId}
      currentUserId={currentUserId}
      workspaceSlug={workspaceSlug}
      presence={presence}
    />
  );
}
