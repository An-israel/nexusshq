import React from "react";
import { Square, Send, Trash2, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface VoiceNoteRecorderProps {
  onSend: (blob: Blob, duration: number, waveformData: number[]) => Promise<void>;
  onCancel: () => void;
  disabled?: boolean;
}

type RecorderPhase = "starting" | "recording" | "preview";

const WAVEFORM_BARS = 40;
const SAMPLE_INTERVAL_MS = 100;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceNoteRecorder({ onSend, onCancel, disabled }: VoiceNoteRecorderProps) {
  const [phase, setPhase] = React.useState<RecorderPhase>("starting");
  const [elapsed, setElapsed] = React.useState(0);
  const [bars, setBars] = React.useState<number[]>(Array(WAVEFORM_BARS).fill(0));
  const [sending, setSending] = React.useState(false);
  const [previewPlaying, setPreviewPlaying] = React.useState(false);
  const [previewProgress, setPreviewProgress] = React.useState(0);

  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const blobRef = React.useRef<Blob | null>(null);
  const waveformSamplesRef = React.useRef<number[]>([]);
  const animFrameRef = React.useRef<number>(0);
  const timerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const sampleIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = React.useRef(0);
  const audioElRef = React.useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = React.useRef<string | null>(null);
  const startedRef = React.useRef(false);

  function stopTimers() {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (sampleIntervalRef.current) clearInterval(sampleIntervalRef.current);
  }

  function releaseStream() {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
    }
    streamRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
  }

  function drawBars() {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const step = Math.floor(data.length / WAVEFORM_BARS);
    const next = Array.from({ length: WAVEFORM_BARS }, (_, i) => {
      const slice = data.slice(i * step, (i + 1) * step);
      const avg = slice.reduce((s, v) => s + v, 0) / (slice.length || 1);
      return avg / 255;
    });
    setBars(next);
    animFrameRef.current = requestAnimationFrame(drawBars);
  }

  // Auto-start recording on mount
  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        chunksRef.current = [];
        waveformSamplesRef.current = [];
        durationRef.current = 0;

        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
            ? "audio/ogg;codecs=opus"
            : "";

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          blobRef.current = blob;
          if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
          previewUrlRef.current = URL.createObjectURL(blob);
          setPhase("preview");
        };

        recorder.start(100);
        setPhase("recording");

        drawBars();

        timerRef.current = setInterval(() => {
          durationRef.current += 0.1;
          setElapsed((prev) => prev + 0.1);
        }, 100);

        sampleIntervalRef.current = setInterval(() => {
          const a = analyserRef.current;
          if (!a) return;
          const d = new Uint8Array(a.frequencyBinCount);
          a.getByteFrequencyData(d);
          const avg = d.reduce((s, v) => s + v, 0) / d.length / 255;
          waveformSamplesRef.current.push(avg);
        }, SAMPLE_INTERVAL_MS);
      } catch {
        toast.error("Microphone access denied");
        onCancel();
      }
    })();

    return () => {
      stopTimers();
      releaseStream();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopRecording() {
    stopTimers();
    releaseStream();
    mediaRecorderRef.current?.stop();
  }

  function handleCancel() {
    stopTimers();
    releaseStream();
    mediaRecorderRef.current?.stop();
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    onCancel();
  }

  function normaliseWaveform(samples: number[]): number[] {
    if (samples.length === 0) return [];
    const max = Math.max(...samples, 0.01);
    const target = Math.min(samples.length, 100);
    const step = samples.length / target;
    return Array.from({ length: target }, (_, i) => {
      const idx = Math.floor(i * step);
      return Math.round((samples[idx] / max) * 100) / 100;
    });
  }

  async function handleSend() {
    const blob = blobRef.current;
    if (!blob) return;
    setSending(true);
    try {
      const normalised = normaliseWaveform(waveformSamplesRef.current);
      await onSend(blob, durationRef.current, normalised);
    } catch {
      toast.error("Failed to send voice note");
      setSending(false);
    }
  }

  function togglePreviewPlay() {
    const audio = audioElRef.current;
    if (!audio) return;
    if (previewPlaying) {
      audio.pause();
    } else {
      void audio.play();
    }
    setPreviewPlaying(!previewPlaying);
  }

  if (phase === "starting") {
    return (
      <div className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-3 flex items-center gap-3">
        <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-sm text-[#9CA3AF]">Requesting microphone…</span>
      </div>
    );
  }

  if (phase === "recording") {
    return (
      <div className="rounded-xl border border-red-500/30 bg-[#1A1A1A] px-3 py-2.5">
        <div className="flex items-center gap-3">
          {/* Cancel */}
          <button
            type="button"
            onClick={handleCancel}
            className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-white hover:bg-[#252525] transition-colors shrink-0"
            aria-label="Cancel recording"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Live waveform */}
          <div className="flex-1 flex items-center gap-px h-8 overflow-hidden">
            {bars.map((v, i) => (
              <div
                key={i}
                className="flex-1 rounded-full bg-red-500 transition-all duration-75"
                style={{ height: `${Math.max(4, v * 32)}px` }}
              />
            ))}
          </div>

          {/* Timer */}
          <span className="text-xs font-mono text-red-400 shrink-0 w-10 text-right">
            {formatDuration(elapsed)}
          </span>

          {/* Stop */}
          <button
            type="button"
            onClick={stopRecording}
            className="p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-400 transition-colors shrink-0"
            aria-label="Stop recording"
          >
            <Square className="w-4 h-4" fill="white" />
          </button>
        </div>
      </div>
    );
  }

  // preview
  return (
    <div className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] px-3 py-2.5">
      <audio
        ref={audioElRef}
        src={previewUrlRef.current ?? undefined}
        onEnded={() => setPreviewPlaying(false)}
        onTimeUpdate={() => {
          const a = audioElRef.current;
          if (a && a.duration) setPreviewProgress(a.currentTime / a.duration);
        }}
      />

      <div className="flex items-center gap-3">
        {/* Discard */}
        <button
          type="button"
          onClick={handleCancel}
          className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-red-400 hover:bg-[#252525] transition-colors shrink-0"
          aria-label="Discard voice note"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Play/Pause */}
        <button
          type="button"
          onClick={togglePreviewPlay}
          className="p-1.5 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors shrink-0"
          aria-label={previewPlaying ? "Pause preview" : "Play preview"}
        >
          {previewPlaying ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5 ml-0.5" />
          )}
        </button>

        {/* Progress bar */}
        <div className="flex-1 h-1.5 bg-[#2A2A2A] rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${previewProgress * 100}%` }}
          />
        </div>

        {/* Duration */}
        <span className="text-xs font-mono text-[#9CA3AF] shrink-0 w-10 text-right">
          {formatDuration(durationRef.current)}
        </span>

        {/* Send */}
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sending || disabled}
          className={cn(
            "p-1.5 rounded-lg bg-primary text-white transition-colors shrink-0",
            sending || disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-primary/90",
          )}
          aria-label="Send voice note"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
