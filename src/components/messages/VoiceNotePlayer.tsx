import React from "react";
import { Play, Pause, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { VoiceNote } from "@/lib/messaging/types";

interface VoiceNotePlayerProps {
  voiceNote: VoiceNote;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;
const PLAYER_BARS = 50;

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function buildDisplayBars(waveformData: number[] | null): number[] {
  const source = waveformData && waveformData.length > 0 ? waveformData : null;
  if (!source) {
    // Generate a plausible-looking waveform if none stored
    return Array.from({ length: PLAYER_BARS }, (_, i) => {
      const x = (i / PLAYER_BARS) * Math.PI * 4;
      return 0.3 + 0.5 * Math.abs(Math.sin(x));
    });
  }
  // Resample to PLAYER_BARS
  const step = source.length / PLAYER_BARS;
  return Array.from({ length: PLAYER_BARS }, (_, i) => {
    const idx = Math.min(Math.floor(i * step), source.length - 1);
    return Math.max(0.08, source[idx]);
  });
}

export function VoiceNotePlayer({ voiceNote: initialVoiceNote }: VoiceNotePlayerProps) {
  const [vn, setVn] = React.useState(initialVoiceNote);
  const [playing, setPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [speedIdx, setSpeedIdx] = React.useState(1);
  const [showTranscription, setShowTranscription] = React.useState(false);
  const [audioSrc, setAudioSrc] = React.useState<string>("");
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  React.useEffect(() => {
    if (!vn.storage_path) return;
    supabase.storage
      .from("voice-notes")
      .createSignedUrl(vn.storage_path, 3600)
      .then(({ data }) => {
        if (data?.signedUrl) setAudioSrc(data.signedUrl);
      });
  }, [vn.storage_path]);

  // Keep local vn in sync with prop (e.g. optimistic update from parent)
  React.useEffect(() => {
    setVn(initialVoiceNote);
  }, [initialVoiceNote]);

  // Realtime subscription for transcription status updates
  React.useEffect(() => {
    if (vn.transcription_status === "completed" || vn.transcription_status === "failed") return;

    const channel = supabase
      .channel(`voice-note-${vn.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "voice_notes",
          filter: `id=eq.${vn.id}`,
        },
        (payload) => {
          setVn((prev) => ({ ...prev, ...(payload.new as Partial<VoiceNote>) }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [vn.id, vn.transcription_status]);

  const displayBars = React.useMemo(() => buildDisplayBars(vn.waveform_data), [vn.waveform_data]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.playbackRate = SPEEDS[speedIdx];
      void audio.play();
    }
    setPlaying(!playing);
  }

  function cycleSpeed() {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  }

  function handleBarClick(i: number) {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const ratio = i / PLAYER_BARS;
    audio.currentTime = ratio * audio.duration;
    setProgress(ratio);
  }

  const isTranscribing =
    vn.transcription_status === "pending" || vn.transcription_status === "processing";

  return (
    <div className="mt-1 flex flex-col gap-1.5 rounded-xl border border-[#2A2A2A] bg-[#151515] px-3 py-2.5 max-w-sm">
      <audio
        ref={audioRef}
        src={audioSrc}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (a && a.duration) setProgress(a.currentTime / a.duration);
        }}
        preload="metadata"
      />

      <div className="flex items-center gap-2.5">
        {/* Play/Pause */}
        <button
          type="button"
          onClick={togglePlay}
          className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
        </button>

        {/* Waveform */}
        <div
          className="flex-1 flex items-end gap-px h-8 cursor-pointer"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            const i = Math.floor(ratio * PLAYER_BARS);
            handleBarClick(i);
          }}
          aria-label="Seek"
          role="slider"
          aria-valuenow={Math.round(progress * 100)}
        >
          {displayBars.map((v, i) => {
            const filled = i / PLAYER_BARS <= progress;
            return (
              <div
                key={i}
                className={cn(
                  "flex-1 rounded-full transition-colors",
                  filled ? "bg-primary" : "bg-[#3A3A3A]",
                )}
                style={{ height: `${Math.max(4, v * 32)}px` }}
              />
            );
          })}
        </div>

        {/* Duration + Speed */}
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span className="text-xs font-mono text-[#9CA3AF]">
            {formatDuration(vn.duration_seconds)}
          </span>
          <button
            type="button"
            onClick={cycleSpeed}
            className="text-[10px] font-medium text-[#6B7280] hover:text-white bg-[#252525] rounded px-1 py-0.5 transition-colors"
            aria-label="Change playback speed"
          >
            {SPEEDS[speedIdx]}×
          </button>
        </div>
      </div>

      {/* Transcription row */}
      {(vn.transcription || isTranscribing) && (
        <div>
          <button
            type="button"
            onClick={() => setShowTranscription((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-[#6B7280] hover:text-white transition-colors"
            aria-label={showTranscription ? "Hide transcription" : "Show transcription"}
          >
            {isTranscribing ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Transcribing…
              </>
            ) : (
              <>
                {showTranscription ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                Transcription
              </>
            )}
          </button>

          {showTranscription && vn.transcription && (
            <p className="mt-1 text-xs text-[#9CA3AF] leading-relaxed italic">
              &ldquo;{vn.transcription}&rdquo;
            </p>
          )}
        </div>
      )}
    </div>
  );
}
