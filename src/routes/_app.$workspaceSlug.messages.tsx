import * as React from "react";
import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { useChannels } from "@/lib/messaging/use-channels";
import { useDmConversations } from "@/lib/messaging/use-dm-conversations";
import { usePresence } from "@/lib/messaging/use-presence";
import { MessagesSidebar } from "@/components/messages/MessagesSidebar";
import { CreateChannelModal } from "@/components/messages/CreateChannelModal";
import { NewDmModal } from "@/components/messages/NewDmModal";
import { QuickSwitcher } from "@/components/messages/QuickSwitcher";
import { SearchModal } from "@/components/messages/SearchModal";
import { usePushNotifications } from "@/lib/messaging/use-push-notifications";
import { cn } from "@/lib/utils";
import type { MsgProfile, UserPresence } from "@/lib/messaging/types";

export const Route = createFileRoute("/_app/$workspaceSlug/messages")({
  component: MessagesLayout,
});

interface MessagingCtxValue {
  workspaceMembers: MsgProfile[];
  presence: Record<string, UserPresence>;
  updateMyPresence: ReturnType<typeof usePresence>["updateMyPresence"];
  onMobileBack: () => void;
}

export const MessagingCtx = React.createContext<MessagingCtxValue | null>(null);

export function useMessagingCtx(): MessagingCtxValue {
  const ctx = React.useContext(MessagingCtx);
  if (!ctx) throw new Error("useMessagingCtx must be inside MessagesLayout");
  return ctx;
}

function MessagesLayout() {
  const { workspaceSlug } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspace } = useWorkspace();

  const workspaceId = workspace?.id ?? null;
  const currentUserId = user?.id ?? null;

  const {
    channels,
    joinedChannels,
    loading: channelsLoading,
    refetch: refetchChannels,
  } = useChannels(workspaceId, currentUserId);
  const {
    conversations,
    startDm,
    refetch: refetchDms,
  } = useDmConversations(workspaceId, currentUserId);
  const { presence, updateMyPresence } = usePresence(workspaceId);

  const [mobileShowSidebar, setMobileShowSidebar] = React.useState(true);
  const [workspaceMembers, setWorkspaceMembers] = React.useState<MsgProfile[]>([]);
  const [createChannelOpen, setCreateChannelOpen] = React.useState(false);
  const [newDmOpen, setNewDmOpen] = React.useState(false);
  const [quickSwitcherOpen, setQuickSwitcherOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    if (!workspaceId) return;

    void (async () => {
      const { data: membershipRows } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId);

      const userIds = Array.from(new Set((membershipRows ?? []).map((row) => row.user_id)));

      if (userIds.length === 0) {
        setWorkspaceMembers([]);
        return;
      }

      const { data: profileRows } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, department, job_title")
        .in("id", userIds)
        .eq("is_active", true);

      setWorkspaceMembers((profileRows ?? []) as MsgProfile[]);
    })();
  }, [workspaceId]);

  React.useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setQuickSwitcherOpen(true);
      }
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const activeChannelId = pathname.match(/\/messages\/channel\/([^/]+)/)?.[1] ?? null;
  const activeConversationId = pathname.match(/\/messages\/dm\/([^/]+)/)?.[1] ?? null;
  const isActivityActive = pathname.endsWith("/messages/activity");

  function goToChannel(id: string) {
    navigate({ to: `/${workspaceSlug}/messages/channel/${id}` as any });
    setMobileShowSidebar(false);
  }

  function goToDm(id: string) {
    navigate({ to: `/${workspaceSlug}/messages/dm/${id}` as any });
    setMobileShowSidebar(false);
  }

  function goToActivity() {
    navigate({ to: `/${workspaceSlug}/messages/activity` as any });
  }

  const autoRedirected = React.useRef(false);

  React.useEffect(() => {
    if (autoRedirected.current) return;
    if (joinedChannels.length > 0 && pathname.endsWith("/messages")) {
      autoRedirected.current = true;
      const general = joinedChannels.find((c) => c.name === "general") ?? joinedChannels[0];
      navigate({ to: `/${workspaceSlug}/messages/channel/${general.id}` as any });
      setMobileShowSidebar(false);
    }
  }, [joinedChannels, pathname]);

  usePushNotifications(currentUserId, workspaceSlug);

  const ctxValue = React.useMemo<MessagingCtxValue>(
    () => ({
      workspaceMembers,
      presence,
      updateMyPresence,
      onMobileBack: () => setMobileShowSidebar(true),
    }),
    [workspaceMembers, presence, updateMyPresence],
  );

  return (
    <MessagingCtx.Provider value={ctxValue}>
      <div className="relative flex h-full overflow-hidden bg-[#0F0F0F]">
        {/* Sidebar panel: full-width on mobile, fixed 256px on desktop */}
        <div
          className={cn(
            // Desktop: static positioning, 256px wide
            "md:relative md:w-64 md:shrink-0 md:translate-x-0",
            // Mobile: absolute, full screen, slides
            "absolute inset-0 w-full z-10",
            "transition-transform duration-[250ms] ease-in-out",
            mobileShowSidebar ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          )}
        >
          <MessagesSidebar
            workspaceSlug={workspaceSlug}
            workspaceName={workspace?.name ?? ""}
            workspaceId={workspaceId ?? ""}
            workspacePrimaryColor={workspace?.primary_color ?? "#6366f1"}
            workspaceLogo={workspace?.logo_url ?? null}
            currentUserId={currentUserId ?? ""}
            activeChannelId={activeChannelId}
            activeConversationId={activeConversationId}
            isActivityActive={isActivityActive}
            channels={channels}
            conversations={conversations}
            presence={presence}
            onSelectChannel={goToChannel}
            onSelectDm={goToDm}
            onSelectActivity={goToActivity}
            onOpenCreateChannel={() => setCreateChannelOpen(true)}
            onOpenNewDm={() => setNewDmOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
            updateMyPresence={updateMyPresence}
          />
        </div>

        {/* Content panel: full-width on mobile, flex-1 on desktop */}
        <div
          className={cn(
            // Desktop: static, fills remaining space
            "md:relative md:flex-1 md:translate-x-0",
            // Mobile: absolute, full screen, starts off-screen to the right
            "absolute inset-0 w-full",
            "transition-transform duration-[250ms] ease-in-out",
            mobileShowSidebar ? "translate-x-full md:translate-x-0" : "translate-x-0",
          )}
        >
          <Outlet />
        </div>
      </div>

      <CreateChannelModal
        open={createChannelOpen}
        onClose={() => setCreateChannelOpen(false)}
        workspaceId={workspaceId ?? ""}
        userId={currentUserId ?? ""}
        onCreated={(channelId) => {
          setCreateChannelOpen(false);
          refetchChannels();
          goToChannel(channelId);
        }}
      />

      <NewDmModal
        open={newDmOpen}
        onClose={() => setNewDmOpen(false)}
        workspaceId={workspaceId ?? ""}
        currentUserId={currentUserId ?? ""}
        startDm={startDm}
        onStarted={(conversationId) => {
          setNewDmOpen(false);
          goToDm(conversationId);
        }}
      />

      <QuickSwitcher
        open={quickSwitcherOpen}
        onClose={() => setQuickSwitcherOpen(false)}
        channels={channels}
        conversations={conversations}
        currentUserId={currentUserId ?? ""}
        workspaceSlug={workspaceSlug}
        onSelectChannel={(id) => {
          goToChannel(id);
          setQuickSwitcherOpen(false);
        }}
        onSelectDm={(id) => {
          goToDm(id);
          setQuickSwitcherOpen(false);
        }}
      />

      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        workspaceId={workspaceId ?? ""}
        currentUserId={currentUserId ?? ""}
        onSelectChannel={(id) => {
          goToChannel(id);
          setSearchOpen(false);
        }}
        onSelectDm={(id) => {
          goToDm(id);
          setSearchOpen(false);
        }}
      />
    </MessagingCtx.Provider>
  );
}
