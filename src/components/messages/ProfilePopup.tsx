import React from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MsgProfile, UserPresence } from "@/lib/messaging/types";

function initialsOf(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hashColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 40%)`;
}

function presenceLabel(presence: UserPresence | undefined): string {
  if (!presence) return "Offline";
  const text = presence.status_text;
  const emoji = presence.status_emoji;
  const prefix = emoji ? `${emoji} ` : "";
  if (text) return `${prefix}${text}`;
  switch (presence.status) {
    case "active":
      return "Active";
    case "away":
      return "Away";
    case "dnd":
      return "Do not disturb";
    default:
      return "Offline";
  }
}

function presenceColor(status: UserPresence["status"] | undefined): string {
  switch (status) {
    case "active":
      return "#22c55e";
    case "away":
      return "#eab308";
    case "dnd":
      return "#ef4444";
    default:
      return "#6b7280";
  }
}

interface Props {
  profile: MsgProfile;
  presence?: UserPresence;
  trigger: React.ReactNode;
  onSendMessage?: () => void;
  workspaceSlug: string;
}

export function ProfilePopup({ profile, presence, trigger, onSendMessage, workspaceSlug }: Props) {
  const [open, setOpen] = React.useState(false);
  const bg = hashColor(profile.id);
  const initials = initialsOf(profile.full_name);

  function handleSendMessage() {
    setOpen(false);
    onSendMessage?.();
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="p-0 border border-[#2A2A2A] bg-[#1A1A1A] rounded-xl shadow-2xl w-72"
        sideOffset={6}
      >
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="relative shrink-0">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name ?? ""}
                  className="w-16 h-16 rounded-xl object-cover"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-xl font-semibold"
                  style={{ backgroundColor: bg }}
                >
                  {initials}
                </div>
              )}
              <span
                className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full border-2 border-[#1A1A1A]"
                style={{ backgroundColor: presenceColor(presence?.status) }}
              />
            </div>

            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-white font-semibold text-sm leading-tight truncate">
                {profile.full_name ?? profile.email ?? "Unknown"}
              </span>
              {profile.department && (
                <Badge
                  variant="secondary"
                  className="self-start text-[10px] bg-[#2A2A2A] text-[#9CA3AF] border-0 px-1.5 py-0.5"
                >
                  {profile.department}
                </Badge>
              )}
              {profile.job_title && (
                <span className="text-xs text-[#6B7280] truncate">{profile.job_title}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#9CA3AF]">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: presenceColor(presence?.status) }}
            />
            <span className="truncate">{presenceLabel(presence)}</span>
          </div>

          <div className={cn("flex flex-col gap-2")}>
            {onSendMessage && (
              <Button
                size="sm"
                onClick={handleSendMessage}
                className="w-full bg-[#2A2A2A] hover:bg-[#333333] text-white border-0 text-xs h-8"
                variant="secondary"
              >
                Send message
              </Button>
            )}
            <a
              href={`/${workspaceSlug}/team/${profile.id}` as unknown as string}
              onClick={() => setOpen(false)}
              className={cn(
                "flex items-center justify-center h-8 rounded-md text-xs",
                "text-[#9CA3AF] hover:text-white hover:bg-[#2A2A2A] transition-colors",
              )}
            >
              View profile
            </a>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
