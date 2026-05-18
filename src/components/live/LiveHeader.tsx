import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface Props {
  lastUpdated: Date;
  isConnected: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}

function updatedText(date: Date): string {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 30) return "just now";
  return formatDistanceToNow(date, { addSuffix: false }) + " ago";
}

export function LiveHeader({ lastUpdated, isConnected, onRefresh, refreshing }: Props) {
  // Force re-render every 10 seconds for the "updated X ago" text
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col border-b border-[#1f1f1f] bg-[#0f0f0f]">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left — title */}
        <h1 className="text-white font-bold text-2xl tracking-tight">Live Operations</h1>

        {/* Right — status + refresh */}
        <div className="flex items-center gap-4">
          {/* LIVE indicator */}
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-bold text-red-400 tracking-widest">LIVE</span>
          </div>

          {/* Updated text */}
          <span className="text-[#555] text-xs hidden sm:block">
            Updated {updatedText(lastUpdated)}
          </span>

          {/* Refresh button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="border-[#2f2f2f] bg-transparent text-[#aaa] hover:text-white hover:border-[#555] h-8 px-3"
          >
            <RefreshCw
              className={cn("w-3.5 h-3.5 mr-1.5", refreshing && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Reconnecting banner */}
      {!isConnected && (
        <div className="flex items-center justify-between px-6 py-2 bg-amber-500/10 border-t border-amber-500/20">
          <span className="text-amber-400 text-sm flex items-center gap-2">
            <span>⚠</span>
            <span>Live updates paused — reconnecting...</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 h-7 px-3 text-xs"
          >
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
