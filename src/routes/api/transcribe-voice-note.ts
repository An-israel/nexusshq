import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Server-side handler: downloads the voice note from Supabase Storage and
// sends it to OpenAI Whisper for transcription. OPENAI_API_KEY must be set
// in the server environment — never expose it client-side.
export const Route = createFileRoute("/api/transcribe-voice-note")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.OPENAI_API_KEY ?? "";
        if (!apiKey) {
          return Response.json(
            { error: "OPENAI_API_KEY is not configured in server environment variables." },
            { status: 500 },
          );
        }

        let body: { voiceNoteId: string; publicUrl: string };
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        const { voiceNoteId, publicUrl } = body;
        if (!voiceNoteId || !publicUrl) {
          return Response.json(
            { error: "voiceNoteId and publicUrl are required" },
            { status: 400 },
          );
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabaseAdmin as any)
          .from("voice_notes")
          .update({ transcription_status: "processing" })
          .eq("id", voiceNoteId);

        try {
          const audioResp = await fetch(publicUrl);
          if (!audioResp.ok) throw new Error(`Failed to download audio: ${audioResp.status}`);
          const audioBuffer = await audioResp.arrayBuffer();

          const ext = publicUrl.split(".").pop()?.split("?")[0] ?? "webm";
          const mimeMap: Record<string, string> = {
            webm: "audio/webm",
            ogg: "audio/ogg",
            mp4: "audio/mp4",
            wav: "audio/wav",
            mp3: "audio/mpeg",
          };
          const mimeType = mimeMap[ext] ?? "audio/webm";

          const formData = new FormData();
          formData.append("file", new Blob([audioBuffer], { type: mimeType }), `audio.${ext}`);
          formData.append("model", "whisper-1");

          const whisperResp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: formData,
          });

          if (!whisperResp.ok) {
            const errText = await whisperResp.text();
            throw new Error(`Whisper API error ${whisperResp.status}: ${errText}`);
          }

          const whisperData = (await whisperResp.json()) as { text?: string };
          const transcription = whisperData.text ?? "";

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabaseAdmin as any)
            .from("voice_notes")
            .update({ transcription, transcription_status: "completed" })
            .eq("id", voiceNoteId);

          return Response.json({ ok: true, transcription });
        } catch (err) {
          console.error("transcribe-voice-note error:", err);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabaseAdmin as any)
            .from("voice_notes")
            .update({ transcription_status: "failed" })
            .eq("id", voiceNoteId);
          return Response.json({ error: String(err) }, { status: 500 });
        }
      },
      GET: async () => Response.json({ ok: true }),
    },
  },
});
