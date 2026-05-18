import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import type { ActivityLogEntry } from "@/lib/live/types";

interface Props {
  entries: ActivityLogEntry[];
  isConnected: boolean;
  lastUpdated: Date;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function relativeTime(isoStr: string): string {
  const date = new Date(isoStr);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 30) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

function lastUpdatedText(date: Date): string {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 30) return "just now";
  return formatDistanceToNow(date, { addSuffix: false }) + " ago";
}

export function ActivityLogPanel({
  entries,
  isConnected,
  lastUpdated,
  collapsed,
  onToggleCollapse,
}: Props) {
  const [tick, setTick] = useState(0);
  const [lastUpdatedTick, setLastUpdatedTick] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastUpdatedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update relative times every 30 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Update "last updated" every 10 seconds
  useEffect(() => {
    lastUpdatedIntervalRef.current = setInterval(
      () => setLastUpdatedTick((t) => t + 1),
      10_000
    );
    return () => {
      if (lastUpdatedIntervalRef.current) clearInterval(lastUpdatedIntervalRef.current);
    };
  }, []);

  // Limit to 100 entries (newest first assumed, drop the oldest)
  const displayedEntries = entries.slice(0, 100);

  if (collapsed) {
    return (
      <div className="hidden lg:flex flex-col items-center w-10 bg-[#0a0a0a] border-l border-[#1f1f1f] h-full py-4 gap-3 flex-shrink-0">
        {/* Expand button */}
        <button
          onClick={onToggleCollapse}
          className="w-7 h-7 rounded-md flex items-center justify-center text-[#555] hover:text-white hover:bg-[#1f1f1f] transition-colors flex-shrink-0"
          aria-label="Expand activity panel"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Connection dot */}
        <div
          className={cn(
            "w-2 h-2 rounded-full flex-shrink-0",
            isConnected ? "bg-green-500" : "bg-amber-500"
          )}
        />

        {/* Rotated label */}
        <div
          className="flex-1 flex items-center justify-center"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          <span className="text-[#555] text-xs font-medium tracking-widest uppercase select-none">
            Live Activity
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="hidden lg:flex flex-col w-[280px] flex-shrink-0 bg-[#0a0a0a] border-l border-[#1f1f1f] h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f1f1f] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-green-500 animate-pulse" : "bg-amber-500"
            )}
          />
          <span className="text-white font-semibold text-sm">Live Activity</span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-xs font-medium",
              isConnected ? "text-green-400" : "text-amber-400"
            )}
          >
            {isConnected ? "Live" : "Reconnecting..."}
          </span>
          {/* Collapse button */}
          <button
            onClick={onToggleCollapse}
            className="w-6 h-6 rounded-md flex items-center justify-center text-[#555] hover:text-white hover:bg-[#1f1f1f] transition-colors"
            aria-label="Collapse activity panel"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Reconnecting banner */}
      {!isConnected && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex-shrink-0">
          <span className="text-amber-400 text-xs">
            ⚠ Live updates paused — reconnecting...
          </span>
        </div>
      )}

      {/* Activity list */}
      <ScrollArea style={{ height: "calc(100vh - 200px)" }} className="flex-1">
        {displayedEntries.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-[#555] text-sm">Waiting for activity...</p>
          </div>
        ) : (
          <div className="divide-y divide-[#111]">
            {displayedEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-2.5 px-4 py-3 hover:bg-white/[0.02] transition-colors"
              >
                <span className="text-base leading-none mt-0.5 flex-shrink-0">
                  {entry.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[#ccc] text-xs leading-snug break-words">
                    {entry.description}
                  </p>
                  {/* tick in dep array to force re-render every 30s */}
                  <span className="text-[#444] text-xs mt-0.5 block">
                    {relativeTime(entry.time)}
                    {/* eslint-disable-next-line @typescript-eslint/no-unused-vars */}
                    {tick === -1 ? null : null}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Footer — last updated */}
      <div className="flex-shrink-0 border-t border-[#1f1f1f] px-4 py-2">
        <span className="text-[#444] text-xs">
          Updated {lastUpdatedText(lastUpdated)}
          {/* force re-render every 10s */}
          {lastUpdatedTick === -1 ? null : null}
        </span>
      </div>
    </div>
  );
}
